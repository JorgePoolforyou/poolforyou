print("🚀 MAIN.PY CARGADO")


import os
import uuid
from datetime import datetime, timedelta
from typing import Optional, List

from fastapi import (
    FastAPI,
    Depends,
    HTTPException,
    status,
    Query,
    UploadFile,
    File,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from jose import JWTError, jwt

from app.db import Base, engine, SessionLocal
from app.models import User, WorkReport
from app.schemas import UserCreate
from app.forms import WORK_REPORT_FORM
from app.settings import SECRET_KEY, ALGORITHM
from app.security import (
    hash_password,
    create_access_token,
    authenticate_user,
    require_role,
    create_email_verification_token,
    verify_email_verification_token,
)
from app.email_service import send_activation_email

# =====================
# APP
# =====================
app = FastAPI(title="PoolForYou API")

# =====================
# CORS (CLAVE)
# =====================
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5500",
    ],
    allow_credentials=False,   # 🔴 CLAVE
    allow_methods=["*"],
    allow_headers=["*"],
)


# =====================
# DB
# =====================
Base.metadata.create_all(bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# =====================
# ROOT
# =====================
@app.get("/")
def root():
    return {"status": "ok"}


# =====================
# FORMS
# =====================
@app.get("/forms/work-report")
def get_work_report_form():
    return WORK_REPORT_FORM


# =====================
# USERS
# =====================
@app.post("/users")
async def create_user(
    user: UserCreate,
    admin: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    new_user = User(
        name=user.name,
        email=user.email,
        role=user.role,
        hashed_password=None,
        email_verified=False,
    )

    try:
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="El email ya existe")

    activation_token = create_email_verification_token(new_user.email)
    activation_link = f"http://localhost:5500/activate.html?token={activation_token}"

    # En local se imprime
    print("📧 ACTIVATION LINK:", activation_link)

    return {
        "id": new_user.id,
        "email": new_user.email,
        "role": new_user.role,
        "message": "Usuario creado",
    }


# =====================
# LOGIN
# =====================
from app.schemas import LoginRequest
from app.security import authenticate_user, create_access_token
from app.db import get_db

@app.post("/login")
def login(
    payload: LoginRequest,
    db: Session = Depends(get_db)
):
    user = authenticate_user(db, payload.email, payload.password)

    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if not user.email_verified:
        raise HTTPException(status_code=403, detail="Email no verificado")

    token = create_access_token(
        {"sub": user.email, "role": user.role}
    )

    return {
        "access_token": token,
        "token_type": "bearer"
    }




# =====================
# WORK REPORTS
# =====================
@app.post("/work-reports")
def create_work_report(
    payload: dict,
    user: User = Depends(require_role("technician", "lifeguard")),
    db: Session = Depends(get_db),
):
    report = WorkReport(
        user_id=user.id,
        location=payload.get("location"),
        data=payload.get("data"),
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    return {"id": report.id}


@app.get("/my/work-reports")
def my_reports(
    user: User = Depends(require_role("technician", "lifeguard")),
    db: Session = Depends(get_db),
):
    return (
        db.query(WorkReport)
        .filter(WorkReport.user_id == user.id)
        .all()
    )


@app.get("/admin/work-reports")
def admin_work_reports(
    status: Optional[str] = Query(None),
    user_id: Optional[int] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    query = db.query(WorkReport)

    if status:
        query = query.filter(WorkReport.status == status)
    if user_id:
        query = query.filter(WorkReport.user_id == user_id)
    if date_from:
        query = query.filter(
            WorkReport.created_at >= datetime.fromisoformat(date_from)
        )
    if date_to:
        query = query.filter(
            WorkReport.created_at < datetime.fromisoformat(date_to) + timedelta(days=1)
        )

    return query.order_by(WorkReport.created_at.desc()).all()


@app.patch("/admin/work-reports/{report_id}")
def update_work_report_status(
    report_id: int,
    status: str = Query(...),
    user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    report = db.query(WorkReport).filter(WorkReport.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Work report not found")

    report.status = status
    db.commit()
    db.refresh(report)
    return {"id": report.id, "status": report.status}


# =====================
# PHOTOS
# =====================
@app.post("/work-reports/{report_id}/photos")
def upload_work_report_photos(
    report_id: int,
    files: List[UploadFile] = File(...),
    user: User = Depends(require_role("technician", "lifeguard", "admin")),
    db: Session = Depends(get_db),
):
    report = db.query(WorkReport).filter(WorkReport.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Work report not found")

    upload_dir = f"uploads/work_reports/{report_id}"
    os.makedirs(upload_dir, exist_ok=True)

    saved_files = []
    for file in files:
        ext = os.path.splitext(file.filename)[1]
        filename = f"{uuid.uuid4()}{ext}"
        path = os.path.join(upload_dir, filename)

        with open(path, "wb") as buffer:
            buffer.write(file.file.read())

        saved_files.append(path)

    report.data.setdefault("photos", []).extend(saved_files)
    db.commit()

    return {"report_id": report.id, "photos": saved_files}


# =====================
# DETAIL
# =====================
@app.get("/work-reports/{report_id}")
def get_work_report_detail(
    report_id: int,
    user: User = Depends(require_role("admin", "technician", "lifeguard")),
    db: Session = Depends(get_db),
):
    report = db.query(WorkReport).filter(WorkReport.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Work report not found")
    return report


# =====================
# STATIC
# =====================
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")


# =====================
# EMAIL VERIFY
# =====================
@app.get("/verify-email")
def verify_email(
    token: str = Query(...),
    db: Session = Depends(get_db),
):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("type") != "email_verify":
            raise HTTPException(status_code=400, detail="Invalid token type")

        email = payload.get("sub")
        user = db.query(User).filter(User.email == email).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        user.email_verified = True
        db.commit()
        return {"message": "Email verificado correctamente"}
    except JWTError:
        raise HTTPException(status_code=400, detail="Invalid or expired token")


# =====================
# ACTIVATE
# =====================
@app.post("/activate")
def activate_account(
    token: str = Query(...),
    password: str = Query(...),
    db: Session = Depends(get_db),
):
    email = verify_email_verification_token(token)
    if not email:
        raise HTTPException(status_code=400, detail="Token inválido")

    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    user.hashed_password = hash_password(password)
    user.email_verified = True
    db.commit()
    return {"message": "Cuenta activada"}


# =====================
# DEV ADMIN (BORRAR EN PROD)
# =====================
from sqlalchemy.exc import IntegrityError

@app.post("/dev/create-admin")
def dev_create_admin(db: Session = Depends(get_db)):
    try:
        user = User(
            name="Admin",
            email="admin@poolforyou.com",
            role="admin",
            hashed_password=hash_password("123456"),
            email_verified=True
        )
        db.add(user)
        db.commit()
        return {"ok": True}

    except IntegrityError:
        db.rollback()
        return {
            "ok": False,
            "message": "El admin ya existe"
        }


@app.post("/dev/create-admin-test")
def dev_create_admin_test(db: Session = Depends(get_db)):
    user = User(
        name="AdminTest",
        email="admin2@poolforyou.com",
        role="admin",
        hashed_password=hash_password("123456"),
        email_verified=True
    )
    db.add(user)
    db.commit()
    return {"ok": True}
