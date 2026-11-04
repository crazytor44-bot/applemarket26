-- А Маркет: проверка срока хранения незавершённых заявок.
-- Этот файл безопасен по умолчанию: он только показывает кандидатов.
-- Значение cutoff_iso задаётся вручную в формате ISO 8601 UTC,
-- например 2026-08-06T00:00:00+00:00.
--
-- Не запускать удаление до:
-- 1) внедрения изменения статусов заказа;
-- 2) проверки, что заявки действительно незавершённые;
-- 3) резервной выгрузки необходимых сведений;
-- 4) отдельного подтверждения владельца.

DECLARE $cutoff_iso AS Utf8;

SELECT id, created_at, status, consent_version
FROM orders
WHERE created_at < $cutoff_iso
  AND status IN ("new", "cancelled")
ORDER BY created_at ASC
LIMIT 500;

-- Шаблон удаления намеренно отключён.
-- После ручной проверки кандидатов выполнить отдельно, сняв комментарии:
--
-- DECLARE $cutoff_iso AS Utf8;
-- DELETE FROM orders
-- WHERE created_at < $cutoff_iso
--   AND status IN ("new", "cancelled");
