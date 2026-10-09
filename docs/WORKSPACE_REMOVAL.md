# Workspace removal safeguards

Ordinary backend writes update an existing tenant row and reject missing workspaces. Workspace creation is explicit during setup or legacy migration and cannot overwrite an existing tenant. API responses use `Cache-Control: no-store`.

Bootstrap removes saved preferences for a missing workspace without removing another workspace's scoped preferences. An authenticated screen rechecks workspace existence on focus, visibility changes and every minute while visible. Missing workspaces are signed out and their in-memory database is reset. Responses from requests started before sign-out are discarded.

Deletion must cover `tenant_state`, legacy `app_state.tenants`, associated sessions and RAI authorization/grant records, and any database branches containing copies. Keep the surviving workspace's payload and timestamps unchanged, verified by checksums. Also check managed authentication tables and database snapshots for separate records.

Browsers outside our control can only clear saved data after contacting the updated app. Managed database recovery history expires according to the provider's retention policy; deleting live records is not immediate physical erasure of that history.
