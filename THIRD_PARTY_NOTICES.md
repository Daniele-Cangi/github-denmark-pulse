# Third-party notices

This repository contains an original presentation and history layer. It does not
vendor the upstream ranking source code, cache, or generated country tables.

The manual capture workflow downloads these projects at runtime:

- [`gayanvoice/top-github-users`](https://github.com/gayanvoice/top-github-users),
  the upstream data repository and country configuration. Its README describes
  the cached data as available under the Open Database License (ODbL).
- [`gayanvoice/top-github-users-action`](https://github.com/gayanvoice/top-github-users-action),
  the ranking engine. The workflow fixes the engine to commit
  [`2b5c26a06abea2b0a7ba98a013ff0ce7fc913477`](https://github.com/gayanvoice/top-github-users-action/commit/2b5c26a06abea2b0a7ba98a013ff0ce7fc913477),
  whose repository includes an MIT license.

The initial evidence was generated in
[`Daniele-Cangi/top-github-users`](https://github.com/Daniele-Cangi/top-github-users),
a fork retained unchanged as an audit trail. See the snapshot provenance for
the exact run, commits, file paths, and SHA-256 hashes.

No endorsement by the upstream authors is implied.
