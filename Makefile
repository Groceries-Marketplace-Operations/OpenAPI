DC=docker compose -f docker-compose.prod.yml

build:
	$(DC) build

deploy: deploy-backend deploy-frontend

deploy-backend:
	$(DC) build openapi-backend
	$(DC) up -d openapi-db openapi-backend

deploy-frontend:
	$(DC) build openapi-frontend
	$(DC) up -d openapi-frontend

migrate:
	$(DC) exec openapi-backend npx prisma migrate deploy --schema=./prisma/schema.prisma

logs:
	$(DC) logs -f openapi-backend

dev-db:
	docker compose up -d

.PHONY: build deploy deploy-backend deploy-frontend migrate logs dev-db
