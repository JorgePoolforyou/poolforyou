print("🔥🔥 ESTE MAIN.PY ESTA EN PRODUCCION 🔥🔥")

from fastapi import FastAPI, Depends, HTTPException, status, Query, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.staticfiles import StaticFiles

from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timedelta
import os
import uuid

from app.db import get_db, Base, engine
from app.models import User, WorkReport
from app.schemas import UserCreate
from app.security import (
    authenticate_user,
    create_access_token,
    require_role,
    create_email_verification_token,
    verify_email_verification_token,
    hash_password,
)

# ======================================================
# APP
# ======================================================

app = FastAPI()

# ======================================================
# CORS (ANTES DE LAS RUTAS)
# ======================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://poolforyou-frontend.onrender.com",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ======================================================
# DB
# ======================================================

Base.metadata.create_all(bind=engine)

# ======================================================
# DEBUG / HEALTH
# ======================================================

@app.get("/_debug")
def debug():
    return {"debug": "main.py is loaded"}

@app.get("/")
def root():
    return {"status": "ok"}

# ======================================================
# AUTH
# ======================================================

@app.post("/login")
def login(
    form: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    try:
        user = authenticate_user(
            db,
            form.username,
            form.password
        )
    except Exception as e:
        # 🔴 IMPORTANTE: siempre devolver JSON
        raise HTTPException(
            status_code=500,
            detail="Authentication error"
        )

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials"
        )

    if not user.email_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Email not verified"
        )

    token = create_access_token(
        {"sub": user.email, "role": user.role}
    )

    return {
        "access_token": token,
        "token_type": "bearer"
    }

# ======================================================
# USERS
# ======================================================

@app.post("/users")
def create_user(
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

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    token = create_email_verification_token(new_user.email)
    activation_link = f"https://poolforyou-frontend.onrender.com/activate.html?token={token}"

    print("ACTIVATION LINK:", activation_link)

    return {
        "id": new_user.id,
        "email": new_user.email,
        "role": new_user.role,
    }

@app.post("/activate")
def activate_account(
    token: str = Query(...),
    password: str = Query(...),
    db: Session = Depends(get_db),
):
    email = verify_email_verification_token(token)
    if not email:
        raise HTTPException(status_code=400, detail="Invalid token")

    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.hashed_password:
        raise HTTPException(status_code=400, detail="Already activated")

    user.hashed_password = hash_password(password)
    user.email_verified = True
    db.commit()

    return {"message": "Account activated"}

# ======================================================
# WORK REPORTS
# ======================================================

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
    return db.query(WorkReport).filter(
        WorkReport.user_id == user.id
    ).all()

# ======================================================
# FILES
# ======================================================

app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

@app.post("/_init-admin")
def init_admin(db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == "admin@poolforyou.com").first()
    if user:
        return {"status": "exists"}

    admin = User(
        name="Admin",
        email="admin@poolforyou.com",
        role="admin",
        hashed_password=hash_password("123456"),
        email_verified=True,
        is_active=True,
    )
    db.add(admin)
    db.commit()
    return {"status": "created"}
