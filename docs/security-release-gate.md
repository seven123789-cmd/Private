# Security release gate

Deployment target: single authorized operator. No public personnel datasets or credentials in source, history, build output, logs or test fixtures. Use synthetic fixtures only.

Before release: suspend public hosting; restrict repository visibility and collaborator access; investigate historical exposure and follow organizational incident procedures; remove sensitive artifacts from all branches and history with coordinated cleanup; rotate exposed secrets if any; verify anonymous access denied and enforce database RLS and RPC authorization for the designated operator. Disable public signup and review existing sessions and accounts. Keep backups encrypted and access restricted. Do not merge or publish until containment and verification are complete.

Repository privacy alone does not guarantee hosting privacy. SQL changes require separate reviewed deployment. Keep scheduled HR processing in dry-run until validated.
