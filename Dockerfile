# ── Ironveil Chronicles ──────────────────────────────────────────
# Pure static site served by nginx:alpine
# No build step required - vanilla HTML/CSS/JS with ES modules
# ─────────────────────────────────────────────────────────────────

FROM nginx:1.27-alpine

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy game files into nginx web root
COPY index.html  /usr/share/nginx/html/
COPY css/        /usr/share/nginx/html/css/
COPY js/         /usr/share/nginx/html/js/
COPY assets/     /usr/share/nginx/html/assets/

# Correct ownership for nginx process
RUN chown -R nginx:nginx /usr/share/nginx/html \
 && chmod -R 755 /usr/share/nginx/html

# nginx listens on 80 - Coolify will handle TLS termination
EXPOSE 80

# Healthcheck so Coolify knows the container is ready
HEALTHCHECK --interval=15s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost/healthz || exit 1

CMD ["nginx", "-g", "daemon off;"]
