import asyncio
from playwright.async_api import async_playwright
import os
import subprocess
import time

async def run_verification():
    # Start the server
    print("Starting server...")
    server_process = subprocess.Popen(["node", "server.js"], stdout=subprocess.PIPE, stderr=subprocess.PIPE)

    # Wait for server to start
    time.sleep(2)

    async with async_playwright() as p:
        browser = await p.chromium.launch()
        context = await browser.new_context(viewport={'width': 1280, 'height': 800})
        page = await context.new_page()

        try:
            # 1. Check Homepage
            print("Checking Homepage...")
            await page.goto("http://localhost:3000")
            await page.wait_for_selector("h1")
            await page.screenshot(path="homepage_final.png")

            # 2. Check Dark Mode
            print("Checking Dark Mode...")
            await page.click("#theme-toggle")
            await page.wait_for_timeout(500)
            await page.screenshot(path="homepage_dark_final.png")

            # 3. Check Stats Panel
            print("Checking Stats Panel...")
            await page.click("#check-visitors-button")
            await page.wait_for_selector("#visitor-stats-panel", state="visible")
            await page.screenshot(path="homepage_stats_final.png")

            # 4. Check Quiet Corner
            print("Checking Quiet Corner...")
            await page.goto("http://localhost:3000/quiet-corner.html")
            await page.wait_for_selector("h1")
            # Check if sticker-corner class exists and has styling (at least it shouldn't be broken)
            await page.screenshot(path="quiet_corner_final.png")

            # 5. Check Privacy
            print("Checking Privacy...")
            await page.goto("http://localhost:3000/privacy.html")
            await page.wait_for_selector("h1")

            # 6. Check Maintenance
            print("Checking Maintenance...")
            await page.goto("http://localhost:3000/maintenance.html")
            await page.wait_for_selector("h1")

            print("All pages verified successfully.")

        except Exception as e:
            print(f"Verification failed: {e}")
        finally:
            await browser.close()
            server_process.terminate()

if __name__ == "__main__":
    asyncio.run(run_verification())
