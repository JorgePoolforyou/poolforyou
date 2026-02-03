
import os

SECRET_KEY = os.getenv("SECRET_KEY", "super-secret-dev-key-change-me")
ALGORITHM = "HS256"

ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 365
EMAIL_TOKEN_EXPIRE_MINUTES = 60 * 24 * 365

DATABASE_URL = os.getenv("DATABASE_URL")

# 🔹 VARIABLES DE EMAIL (aunque no las uses aún)
MAIL_USERNAME = os.getenv("MAIL_USERNAME")
MAIL_PASSWORD = os.getenv("MAIL_PASSWORD")
MAIL_FROM = os.getenv("MAIL_FROM")
MAIL_SERVER = os.getenv("MAIL_SERVER")
MAIL_PORT = int(os.getenv("MAIL_PORT", "587"))
