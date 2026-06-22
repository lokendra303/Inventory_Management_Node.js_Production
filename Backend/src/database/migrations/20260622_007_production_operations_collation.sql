-- Align production_operations collation with core tables (items, warehouses, institution_users)
ALTER TABLE production_operations CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
