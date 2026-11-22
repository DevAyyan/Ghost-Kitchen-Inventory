"""
Two devices in one kitchen, against a live API (apps/api/test/e2e-server.mts). One has the fridge open;
the other adds food and then bins it. The first must show both without reloading.

    cd apps/api && PORT=3100 npx tsx test/e2e-server.mts &
    LIVE_API_URL=http://127.0.0.1:3100 python3 -m pytest e2e/test_live_sync.py
"""
import os

import pytest

LIVE = os.environ.get('LIVE_API_URL', '').rstrip('/')
pytestmark = pytest.mark.skipif(not LIVE, reason='needs LIVE_API_URL (a running e2e API)')


def _device(browser):
    ctx = browser.new_context(viewport={'width': 1280, 'height': 900}, reduced_motion='reduce')
    page = ctx.new_page()
    page.add_init_script('Date.prototype.getHours = function () { return 12; };')
    page.goto(LIVE + '/', wait_until='networkidle', timeout=120_000)
    try:
        page.get_by_text('Skip', exact=True).click(timeout=4000)
    except Exception:
        pass
    return page


# A device in a kitchen always has one request waiting at the server (that's how it hears of changes),
# so the network never goes idle: wait for the page to load instead.
def _go(page, path):
    page.goto(LIVE + path, wait_until='load')
    page.wait_for_timeout(800)


def _add_by_hand(page, name):
    _go(page, '/review?manual=1')
    field = page.get_by_label('Item name').first
    field.fill(name)
    field.press('Tab')
    page.get_by_text('Confirm & stock fridge', exact=True).click()
    page.get_by_text('moved into the fridge', exact=False).wait_for(timeout=10_000)


def test_a_change_on_one_device_shows_on_the_other_without_reloading(browser):
    phone, laptop = _device(browser), _device(browser)

    # Phone starts a kitchen and invites the laptop.
    phone.goto(LIVE + '/settings', wait_until='networkidle')
    phone.get_by_placeholder('e.g. Flat 4B').fill('Test flat')
    phone.get_by_text('Create', exact=True).click()
    phone.get_by_text('Invite someone', exact=True).click()
    code = phone.get_by_label('Invite code', exact=False).inner_text().strip()
    laptop.goto(LIVE + '/settings', wait_until='networkidle')
    laptop.get_by_placeholder('8 letters and numbers').fill(code)
    laptop.get_by_text('Join', exact=True).click()
    laptop.get_by_text('Test flat', exact=False).first.wait_for(timeout=10_000)

    # The laptop is on its fridge screen. No reloads from here on.
    _go(laptop, '/')

    # The fridge is empty, so there's no door yet: the phone stocks it and the kitchen appears.
    _add_by_hand(phone, 'Pumpkin')
    laptop.get_by_test_id('door-fridge').wait_for(timeout=5_000)

    # The laptop opens the fridge door and stays inside.
    laptop.get_by_test_id('door-fridge').click()
    laptop.get_by_label('Close the fridge door').wait_for(timeout=5_000)

    # Tiles may hyphenate a name to fit, so look for it the way a screen reader would: by its label.
    shelf = laptop.get_by_label('Ghost pepper', exact=False)
    assert shelf.count() == 0
    _add_by_hand(phone, 'Ghost pepper')
    shelf.first.wait_for(timeout=5_000)
    assert laptop.get_by_label('Close the fridge door').count() == 1  # still inside, shelf updated in place

    # Binning it on the phone takes it off the laptop's open shelf too.
    _go(phone, '/')
    phone.get_by_label('Use-first list').click()
    phone.get_by_label('Binned Ghost pepper').click()
    shelf.first.wait_for(state='detached', timeout=5_000)
    assert laptop.get_by_label('Pumpkin', exact=False).count() >= 1
