-- Initialize BMN Indexer Database

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- Create schemas for different environments
CREATE SCHEMA IF NOT EXISTS development;
CREATE SCHEMA IF NOT EXISTS staging;
CREATE SCHEMA IF NOT EXISTS production;

-- Create read-only user for API access
CREATE ROLE bmn_reader WITH LOGIN PASSWORD 'reader_password';

-- Grant permissions
GRANT USAGE ON SCHEMA public TO bmn_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO bmn_reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO bmn_reader;

-- Create indexes for better performance (these will be created by Ponder, but we set up the foundation)
-- Performance monitoring views
CREATE OR REPLACE VIEW indexing_stats AS
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS total_size,
    n_tup_ins AS rows_inserted,
    n_tup_upd AS rows_updated,
    n_tup_del AS rows_deleted,
    n_live_tup AS live_rows,
    n_dead_tup AS dead_rows,
    last_vacuum,
    last_autovacuum
FROM pg_stat_user_tables
WHERE schemaname IN ('public', 'development', 'staging', 'production')
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Create function to analyze query performance
CREATE OR REPLACE FUNCTION analyze_slow_queries()
RETURNS TABLE(
    query_text text,
    calls bigint,
    total_exec_time double precision,
    mean_exec_time double precision,
    max_exec_time double precision
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        pg_stat_statements.query::text,
        pg_stat_statements.calls,
        pg_stat_statements.total_exec_time,
        pg_stat_statements.mean_exec_time,
        pg_stat_statements.max_exec_time
    FROM pg_stat_statements
    WHERE pg_stat_statements.mean_exec_time > 100 -- queries taking more than 100ms
    ORDER BY pg_stat_statements.mean_exec_time DESC
    LIMIT 20;
END;
$$ LANGUAGE plpgsql;

-- Maintenance settings
ALTER SYSTEM SET shared_preload_libraries = 'pg_stat_statements';
ALTER SYSTEM SET pg_stat_statements.track = 'all';
ALTER SYSTEM SET pg_stat_statements.max = 10000;

-- Performance tuning
ALTER SYSTEM SET effective_cache_size = '4GB';
ALTER SYSTEM SET shared_buffers = '1GB';
ALTER SYSTEM SET maintenance_work_mem = '256MB';
ALTER SYSTEM SET checkpoint_completion_target = 0.9;
ALTER SYSTEM SET wal_buffers = '16MB';
ALTER SYSTEM SET default_statistics_target = 100;
ALTER SYSTEM SET random_page_cost = 1.1;
ALTER SYSTEM SET effective_io_concurrency = 200;
ALTER SYSTEM SET work_mem = '32MB';
ALTER SYSTEM SET min_wal_size = '1GB';
ALTER SYSTEM SET max_wal_size = '4GB';

-- Log slow queries
ALTER SYSTEM SET log_min_duration_statement = 1000; -- log queries taking more than 1 second

-- Connection pooling settings
ALTER SYSTEM SET max_connections = 200;

COMMENT ON DATABASE bmn_indexer IS 'Bridge Me Not EVM Contracts Indexer Database';