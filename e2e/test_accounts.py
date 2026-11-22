"""
Sign-in, as far as it can be tested without a real Clerk app: a server without accounts opens straight to
the fridge; a server that asks for Clerk shows the pixel sign-in screen first; an unreachable server says so.
The status reply is faked per test with Playwright routing.
"""
import base64
import json

from conftest import BASE

STATUS = {
    'ok': True, 'db': True, 'ocr': True,
    'ai': {'enabled': False, 'model': '', 'usedToday': 0, 'limitPerDay': 0},
    'recipes': {'provider': 'themealdb', 'keyType': 'test'},
}
# A well-formed development key for a Clerk app that doesn't exist: enough for the screen to render.
FAKE_PK = 'pk_test_' + base64.b64encode(b'ghost-kitchen-e2e.clerk.accounts.dev$').decode()


def status(page, auth):
    def handle(route):
        if auth is None:
            return route.abort()
        route.fulfill(status=200, content_type='application/json', body=json.dumps({**STATUS, 'auth': auth}))
    page.route('**/v1/status', handle)


def test_no_accounts_opens_the_fridge(phone):
    status(phone, {'provider': 'none'})
    phone.goto(BASE + '/', wait_until='networkidle')
    phone.get_by_role('heading', name='Your fridge').wait_for(timeout=15_000)


def test_clerk_server_asks_to_sign_in_first(phone):
    status(phone, {'provider': 'clerk', 'publishableKey': FAKE_PK})
    phone.goto(BASE + '/', wait_until='domcontentloaded')
    phone.get_by_role('heading', name='Ghost Kitchen').wait_for(timeout=15_000)
    assert phone.get_by_label('Continue with Google').count() == 1
    assert phone.get_by_label('Email address').count() == 1
    # The fridge isn't shown to someone who hasn't signed in.
    assert phone.get_by_role('heading', name='Your fridge').count() == 0
    # It's pixel art too.
    family = phone.get_by_role('heading', name='Ghost Kitchen').evaluate('e => getComputedStyle(e).fontFamily')
    assert 'PixelifySans' in family
    # The fake Clerk app can't load, so the page logs network errors; that's expected here.
    phone.errors.clear()  # type: ignore[attr-defined]


def test_unreachable_server_says_so(phone):
    status(phone, None)
    phone.goto(BASE + '/', wait_until='domcontentloaded')
    phone.get_by_role('heading', name="Can't reach your server").wait_for(timeout=15_000)
    assert phone.get_by_role('button', name='Try again').count() == 1
