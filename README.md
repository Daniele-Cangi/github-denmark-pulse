# GitHub Denmark Pulse

A compact, evidence-backed history of
[`Daniele-Cangi`](https://github.com/Daniele-Cangi) in the Denmark ranking.

*Built quietly. Now measurable.*

<!-- latest:start -->
| Public rank | Public contributions | Movement since 23 May 2026 |
| ---: | ---: | ---: |
| **#81** | **1,412** | **↑ 64 places** |

Captured 19 August 2026. Secondary measures: **#76** by total contributions
(3,615, including 2,203 restricted contributions) and **#115** by followers
(297). [Inspect the snapshot](snapshots/2026-08-19.json).
<!-- latest:end -->

![Public contribution rank trajectory](assets/trajectory.svg)

## Recorded history

| Date | Public rank | Public contributions | Change |
| --- | ---: | ---: | ---: |
| 23 May 2026 | #145 | 615 | baseline |
| 19 August 2026 | #81 | 1,412 | +64 places |

The chart is deliberately a trajectory, not a forecast. It connects two
verified observations and makes no claim about the unobserved days between
them. The full append-only record is in [`data/history.csv`](data/history.csv).

## How a capture works

The manual-only workflow runs the upstream Denmark ranking with the same
country configuration and a ranking engine fixed to an exact commit. It then
checks every generated row against the cache before updating the small history
layer in this repository.

For definitions, validation rules, reproducibility instructions, and known
limits, read [`docs/METHODOLOGY.md`](docs/METHODOLOGY.md). The original August
run remains available as [workflow evidence](https://github.com/Daniele-Cangi/top-github-users/actions/runs/32272528671).

## Attribution and license

Ranking data and generation are credited to
[`gayanvoice/top-github-users`](https://github.com/gayanvoice/top-github-users)
and [`gayanvoice/top-github-users-action`](https://github.com/gayanvoice/top-github-users-action).
This presentation layer is MIT-licensed. Details are in
[`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).
