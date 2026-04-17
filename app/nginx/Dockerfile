FROM nginx:1.27-alpine
LABEL authors="Arthicsu"

RUN rm /etc/nginx/conf.d/default.conf

COPY nginx.conf /etc/nginx/nginx.conf
COPY conf.d /etc/nginx/conf.d/

RUN mkdir -p /app/staticfiles /var/cache/nginx

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]