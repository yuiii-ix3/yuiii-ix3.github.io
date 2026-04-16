# Quiet Corner Machine Status

Machine status for Quiet Corner is now built in two stages.

## 1) Collect cached telemetry

Lenovo collector:

```bash
/home/azhar/.openclaw/workspace/scripts/collect_lenovo_telemetry.sh
```

Samsung cache puller:

```bash
/home/azhar/.openclaw/workspace/scripts/collect_samsung_telemetry.sh
```

These fill local cache files in:

```bash
/home/azhar/.openclaw/workspace/telemetry/
```

## 2) Build the website JSON

```bash
python3 /home/azhar/.openclaw/workspace/dacker-projects/landing-page-yui/update_quiet_corner_status.py
```

It refreshes the `machine_status` section inside:

```bash
/home/azhar/.openclaw/workspace/dacker-projects/landing-page-yui/data/quiet-corner-content.json
```

## Suggested cron shape

```bash
*/20 * * * * /home/azhar/.openclaw/workspace/scripts/collect_lenovo_telemetry.sh >/dev/null 2>&1
*/20 * * * * /home/azhar/.openclaw/workspace/scripts/collect_samsung_telemetry.sh >/dev/null 2>&1
*/30 * * * * python3 /home/azhar/.openclaw/workspace/dacker-projects/landing-page-yui/update_quiet_corner_status.py >/dev/null 2>&1
```

## Notes

- The website updater now reads cached telemetry files instead of doing live collection.
- That means a slow Samsung fetch should not block the Quiet Corner JSON update.
- If Samsung cache data is missing, Quiet Corner can still update Lenovo and mark Samsung as waiting.
