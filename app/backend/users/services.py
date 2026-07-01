from django.core.mail import send_mail
from django.conf import settings
from core.admin_password_generator import generate_password

def send_recovery_password(user, user_name):
    new_password = generate_password()

    user.set_password(new_password)
    user.save() 
    
    subject = "Ваш новый пароль"
    message = f"Привет, {user_name}! Ваш новый временный пароль: {new_password}"
    
    send_mail(
        subject,
        message,
        settings.DEFAULT_FROM_EMAIL,
        [user.email],
        fail_silently=False,
    )
    
    return new_password
