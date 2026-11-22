"""
Demo mode: the whole pitch (scan the sample receipt, stock the fridge, find recipes) with no server and
no internet. The static app is served with nothing behind it, and every outside request is blocked.
"""
from conftest import BASE, open_app


def _offline(page):
    # Only the app itself loads; TheMealDB photos, Gemini, the API: all refused.
    page.route('**/*', lambda r: r.continue_() if r.request.url.startswith(BASE) else r.abort())


def test_demo_runs_the_whole_flow_offline(phone):
    _offline(phone)
    open_app(phone)  # /?demo=1 loads the sample fridge and turns demo mode on
    assert phone.get_by_label('Demo mode is on', exact=False).count() == 1

    phone.goto(BASE + '/scan', wait_until='networkidle')
    assert phone.get_by_text('recorded samples', exact=False).count() >= 1
    phone.get_by_text('Use the sample receipt', exact=True).click()
    phone.get_by_text('Green Grocer Market', exact=False).wait_for(timeout=15_000)
    assert phone.get_by_label('Item name').count() == 10
    # The sample fridge already has spinach, milk, eggs: the review says so.
    assert phone.get_by_text('You already have', exact=False).count() >= 1
    phone.get_by_text('Confirm & stock fridge', exact=True).click()
    phone.get_by_text('moved into the fridge', exact=False).wait_for(timeout=5000)

    phone.goto(BASE + '/recipes', wait_until='networkidle')
    phone.get_by_text('Find recipes', exact=True).first.click()
    phone.get_by_text('recorded for offline use', exact=False).wait_for(timeout=10_000)
    assert phone.get_by_text("Can't reach", exact=False).count() == 0


def test_turning_demo_mode_off_restores_the_server_settings(phone):
    _offline(phone)
    open_app(phone)
    phone.goto(BASE + '/settings', wait_until='networkidle')
    assert phone.get_by_text("this server isn't used", exact=False).count() == 1
    phone.get_by_role('switch', name='Use recorded sample answers').click()
    phone.wait_for_timeout(300)
    assert phone.get_by_text("this server isn't used", exact=False).count() == 0
    assert phone.get_by_label('Demo mode is on', exact=False).count() == 0
