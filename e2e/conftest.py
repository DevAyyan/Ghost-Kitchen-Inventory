"""
Browser tests for the web app (Playwright, Chromium). They run against the exported app with no server,
which is how the fridge works offline anyway.

    pip install -r e2e/requirements.txt && python3 -m playwright install chromium
    cd apps/mobile && npx expo export --platform web && cd ../..
    python3 e2e/serve.py apps/mobile/dist 8099 &
    E2E_URL=http://127.0.0.1:8099 python3 -m pytest e2e

Point E2E_URL at http://localhost:3000 to test the Docker build instead. UPDATE_BASELINES=1 rewrites the
screenshots in e2e/baselines after an intended visual change.
"""
import os

import pytest
from playwright.sync_api import Browser, Page, sync_playwright

BASE = os.environ.get('E2E_URL', 'http://127.0.0.1:8099').rstrip('/')


@pytest.fixture(scope='session')
def browser():
    with sync_playwright() as p:
        b = p.chromium.launch()
        yield b
        b.close()


def _page(browser: Browser, width: int, height: int, reduced: bool) -> Page:
    ctx = browser.new_context(viewport={'width': width, 'height': height}, reduced_motion='reduce' if reduced else 'no-preference')
    page = ctx.new_page()
    # The kitchen darkens in the evening, so screenshots would depend on when tests run. Only the hour is
    # pinned to midday; dates and Date.now() stay real, so animations and expiry dates behave normally.
    page.add_init_script('Date.prototype.getHours = function () { return 12; };')
    page.errors = []  # type: ignore[attr-defined]
    page.on('pageerror', lambda e: page.errors.append(str(e)))  # type: ignore[attr-defined]
    return page


def open_app(page: Page, path: str = '/?demo=1') -> Page:
    """Loads the app with the sample fridge and gets past the first-run intro."""
    page.goto(BASE + path, wait_until='networkidle', timeout=120_000)
    skip = page.get_by_text('Skip', exact=True)
    try:
        skip.click(timeout=4000)
    except Exception:
        pass
    # The "Demo fridge loaded" toast would land in screenshots at random; tap it away.
    note = page.get_by_text('Demo fridge loaded', exact=False)
    if note.count():
        note.first.click()
    # Fonts and sprites settle.
    page.wait_for_timeout(800)
    return page


@pytest.fixture
def phone(browser):
    """390 x 844 with reduced motion: doors open instantly and effects hold still, so runs are repeatable."""
    page = _page(browser, 390, 844, reduced=True)
    yield page
    assert not page.errors, page.errors  # type: ignore[attr-defined]
    page.context.close()


@pytest.fixture
def phone_live(browser):
    """390 x 844 with motion on, for the animations themselves."""
    page = _page(browser, 390, 844, reduced=False)
    yield page
    assert not page.errors, page.errors  # type: ignore[attr-defined]
    page.context.close()


@pytest.fixture
def narrow(browser):
    page = _page(browser, 320, 700, reduced=True)
    yield page
    assert not page.errors, page.errors  # type: ignore[attr-defined]
    page.context.close()


@pytest.fixture
def desktop(browser):
    page = _page(browser, 1280, 800, reduced=True)
    yield page
    assert not page.errors, page.errors  # type: ignore[attr-defined]
    page.context.close()
