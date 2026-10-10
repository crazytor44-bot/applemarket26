-- Выполнить в YDB Query Editor выбранной базы, режим YQL.
-- Убедиться, что база в регионе ru-central1, что доступ есть только у сервисного аккаунта.
CREATE TABLE orders (
    id Utf8 NOT NULL,
    created_at Utf8,
    customer_name Utf8,
    phone Utf8,
    city Utf8,
    preferred_contact Utf8,
    comment Utf8,
    items_json Utf8,
    declared_total Uint64,
    status Utf8,
    PRIMARY KEY (id)
);
