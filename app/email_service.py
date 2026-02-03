import os
from fastapi_mail import FastMail, MessageSchema, ConnectionConfig

from app.settings import (
    MAIL_USERNAME,
    MAIL_PASSWORD,
    MAIL_FROM,
    MAIL_SERVER,
    MAIL_PORT,
)

# 🔹 SOLO crear configuración si hay email definido
def get_mail_config():
    if not all([MAIL_USERNAME, MAIL_PASSWORD, MAIL_SERVER, MAIL_FROM]):
        return None

    return ConnectionConfig(
        MAIL_USERNAME=MAIL_USERNAME,
        MAIL_PASSWORD=MAIL_PASSWORD,
        MAIL_FROM=MAIL_FROM,
        MAIL_SERVER=MAIL_SERVER,
        MAIL_PORT=MAIL_PORT,
        MAIL_STARTTLS=True,
        MAIL_SSL_TLS=False,
        USE_CREDENTIALS=True,
    )


async def send_activation_email(email: str, activation_link: str):
    conf = get_mail_config()

    # 🚫 EMAIL DESACTIVADO (modo local)
    if conf is None:
        print("📧 EMAIL DESACTIVADO — link de activación:")
        print(activation_link)
        return

    message = MessageSchema(
        subject="Activa tu cuenta en PoolForYou",
        recipients=[email],
        body=f"""
Hola,

Se te ha dado acceso al portal PoolForYou.

Activa tu cuenta y crea tu contraseña aquí:
{activation_link}

Si no esperabas este correo, ignóralo.
""",
        subtype="plain",
    )

    fm = FastMail(conf)
    await fm.send_message(message)
