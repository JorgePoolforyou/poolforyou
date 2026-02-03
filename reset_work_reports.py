from app.db import engine
from app.models import WorkReport

print("Eliminando tabla work_reports si existe...")
WorkReport.__table__.drop(engine, checkfirst=True)

print("Creando tabla work_reports de nuevo...")
WorkReport.__table__.create(engine)

print("DONE ✔")
