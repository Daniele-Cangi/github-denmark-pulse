# Methodology

## Scope

GitHub Denmark Pulse records discrete observations of the `Daniele-Cangi`
account in the Denmark tables produced by the upstream Top GitHub Users
project. It is a personal history and presentation layer, not a replacement
ranking engine and not an official GitHub product.

The primary measure is public contributions. Total contributions, restricted
contributions, and followers are retained as secondary context when the source
run provides them.

## What the numbers mean

- **Public rank** is the account's one-based position after the upstream engine
  sorts the Denmark candidate cache by `publicContributions`.
- **Total rank** uses `publicContributions + privateContributions`. The upstream
  cache names the second field `privateContributions`; this repository labels
  it **restricted contributions** because the aggregate does not reveal private
  activity details.
- **Follower rank** sorts the same candidate cache by follower count.
- **Candidate count** is the size of the Denmark cache, not the population of
  Denmark and not every GitHub account located there.

Contribution values are capture-time aggregates returned through GitHub's
contribution collection. They can rise or fall as the collection window and
GitHub's underlying data change. Rankings are therefore snapshots, not lifetime
scores.

## Candidate discovery and limits

The upstream country configuration searches for Denmark and the cities
Copenhagen, Aarhus, Aalborg, Odense, Esbjerg, and Kolding. The upstream engine
also applies its own follower threshold and GitHub Search pagination behavior.
For the 19 August 2026 run, 912 candidate records were retained and the search
log reached `hasNextPage: false`.

Location text is self-reported and can be absent, ambiguous, or stale. Search
limits, API behavior, renamed accounts, ties, and upstream code changes can all
affect the result. A higher position means a smaller rank number.

## Reproduction

The workflow `.github/workflows/capture-denmark.yml` is intentionally available
only through `workflow_dispatch`.

1. It checks out `gayanvoice/top-github-users` at the selected data ref.
2. It checks out `gayanvoice/top-github-users-action` at the fixed commit
   `2b5c26a06abea2b0a7ba98a013ff0ce7fc913477`.
3. It changes only two runtime controls in the temporary data checkout:
   `devMode` is enabled to prevent upstream pull/commit/push operations, and the
   checkpoint is set to the Denmark entry discovered from the upstream config.
4. It runs the bundled upstream action with a repository secret named
   `CUSTOM_TOKEN`.
5. It parses the Denmark cache and all three generated tables. Validation
   reproduces the upstream stable-sort sequence, checks every emitted login,
   rank, and value, requires GraphQL pagination to finish, and rejects nonzero
   observed Octokit errors.
6. Only the CSV history, a dated JSON snapshot, the README summary, and the SVG
   trajectory are committed here. The temporary upstream checkout is ignored.

GitHub Actions and the upstream engine are fixed to full commit SHAs in the
workflow. The selected upstream data commit and the engine commit are written
into every snapshot.

## Evidence model

`data/history.csv` is the compact time series. A dated file under `snapshots/`
contains the richer observation, including provenance, validation counts,
thresholds, and hashes of the generated Denmark evidence files.

The initial 19 August 2026 snapshot points to the successful source run and to
commit `adc6d595475975a9ff83ee81ba6addefe8ef05ba` in the retained fork. Its four
evidence-file SHA-256 values allow the source material to be checked without
copying the large upstream dataset into this repository.

The 23 May 2026 row is a historical observation recovered from the Denmark
public-contributions table present at upstream data commit
`f26e9755828edeb3ce50d9816d087f861307d0af`. Only the public rank and public
contribution count are asserted for that date; unavailable secondary fields
remain empty rather than being inferred.
