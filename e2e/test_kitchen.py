"""The pixel kitchen: doors, the open compartment, ghosts, adding food, and narrow phones."""
import re

from conftest import open_app


def test_doors_open_to_the_shelves_and_close_again(phone):
    open_app(phone)
    for zone in ('fridge', 'freezer', 'pantry'):
        door = phone.get_by_test_id(f'door-{zone}')
        door.scroll_into_view_if_needed()
        door.click()
        close = phone.get_by_label(f'Close the {zone} door')
        close.wait_for(timeout=5000)
        # The open compartment takes over the page, so the fridge screen's title is gone.
        assert phone.get_by_role('heading', name='Your fridge').count() == 0
        close.click()
        phone.get_by_test_id(f'door-{zone}').wait_for(timeout=5000)


def test_open_compartment_fills_the_page(phone):
    open_app(phone)
    phone.get_by_test_id('door-fridge').click()
    group = phone.get_by_role('group', name=re.compile(r'^Fridge, \d+ items'))
    group.wait_for(timeout=5000)
    box = group.bounding_box()
    # Most of the 390 x 844 window, minus the top bar and bottom nav.
    assert box['width'] >= 0.9 * 390
    assert box['height'] >= 0.6 * 844


def test_doors_with_turning_food_stand_ajar_and_say_so(phone):
    open_app(phone)
    # The sample fridge has expiring and spoiled food, so its door is ajar and its chip explains why.
    assert phone.get_by_text(re.compile(r'^\d+ haunting$')).count() >= 1
    label = phone.get_by_test_id('door-fridge').get_attribute('aria-label')
    assert label.startswith('Fridge door, closed.') and 'spoiled' in label


def test_poking_a_peeking_ghost_opens_the_most_urgent_food(phone_live):
    page = open_app(phone_live)
    page.get_by_test_id('door-fridge').scroll_into_view_if_needed()
    ghost = page.locator('[data-testid^="ghost-"]').first
    ghost.wait_for(state='attached', timeout=20_000)
    ghost.click(force=True)
    page.wait_for_url(re.compile(r'[?&]item='), timeout=5000)


def test_doors_offer_the_urgent_food_to_screen_readers(phone):
    open_app(phone)
    door = phone.get_by_test_id('door-fridge')
    # On web the shortcut is in the label (React Native web has no hint); Android gets it as a hint and an action.
    assert 'Press U for the most urgent food' in door.get_attribute('aria-label')
    door.focus()
    phone.keyboard.press('u')
    phone.wait_for_url(re.compile(r'[?&]item='), timeout=5000)


def test_adding_food_offers_every_section_but_never_the_pantry_for_meat(phone):
    open_app(phone, '/scan')
    phone.get_by_text('Enter items by hand').first.click()
    name = phone.get_by_label('Item name').first
    name.fill('Bread')
    name.press('Tab')
    phone.get_by_label('Where to store Bread').click()
    options = [o.strip() for o in phone.get_by_role('option').all_inner_texts()]
    assert {'Fridge', 'Freezer', 'Pantry'} <= set(options), options
    phone.keyboard.press('Escape')

    name.fill('Mince')
    name.press('Tab')
    phone.get_by_label('Type of Mince').click()
    phone.get_by_role('option', name='Meat').click()
    phone.get_by_label('Where to store Mince').click()
    options = [o.strip() for o in phone.get_by_role('option').all_inner_texts()]
    assert 'Pantry' not in options and 'Fridge' in options, options


def test_everything_uses_the_pixel_fonts(phone):
    open_app(phone)
    body = phone.get_by_text('Click a door to open it').or_(phone.get_by_text('Tap a door to open it')).first
    assert 'VT323' in body.evaluate('e => getComputedStyle(e).fontFamily')
    title = phone.get_by_role('heading', name='Your fridge')
    assert 'PixelifySans' in title.evaluate('e => getComputedStyle(e).fontFamily')


def test_320_wide_nothing_overflows_and_the_wordmark_fits(narrow):
    open_app(narrow)
    width = narrow.evaluate('() => document.documentElement.scrollWidth')
    assert width <= 320, width
    mark = narrow.get_by_text('Ghost Kitchen', exact=True).first
    assert mark.bounding_box()['height'] <= 30
    # Scene chips stay inside the scene.
    scene = narrow.get_by_test_id('door-pantry').locator('xpath=..').bounding_box()
    chip = narrow.get_by_text('Pantry', exact=True).first.bounding_box()
    assert chip['x'] + chip['width'] <= scene['x'] + scene['width'] + 1


def test_review_warns_when_the_food_is_already_in_the_fridge(phone):
    open_app(phone)  # the sample fridge loads on the fridge screen
    phone.goto(phone.url.split('/?')[0].rstrip('/') + '/scan', wait_until='networkidle')
    phone.get_by_text('Enter items by hand').first.click()
    name = phone.get_by_label('Item name').first
    name.fill('Spinach')
    name.press('Tab')
    warning = phone.get_by_text('You already have', exact=False)
    assert warning.count() == 1 and 'Use that first' in warning.first.inner_text()
    name.fill('Dragon fruit')
    name.press('Tab')
    assert phone.get_by_text('You already have', exact=False).count() == 0


def test_settings_offer_a_budget_and_an_export(phone):
    open_app(phone)  # the sample fridge loads on the fridge screen
    phone.goto(phone.url.split('/?')[0].rstrip('/') + '/settings', wait_until='networkidle')
    assert phone.get_by_text('Monthly budget', exact=True).count() >= 1
    with phone.expect_download(timeout=10_000) as dl:
        phone.get_by_text('Export my data', exact=True).click()
    assert dl.value.suggested_filename.startswith('ghost-kitchen-') and dl.value.suggested_filename.endswith('.json')
    import json
    data = json.loads(open(dl.value.path(), encoding='utf-8').read())
    assert data['items'] and 'apiToken' not in json.dumps(data)


def test_ledger_shows_the_budget_once_one_is_set(phone):
    open_app(phone)  # the sample fridge loads on the fridge screen
    phone.goto(phone.url.split('/?')[0].rstrip('/') + '/settings', wait_until='networkidle')
    phone.get_by_label('Monthly grocery budget', exact=False).fill('400')
    phone.get_by_text('Save', exact=True).first.click()
    phone.get_by_text('Budget saved', exact=False).wait_for(timeout=5000)
    phone.goto(phone.url.split('/settings')[0] + '/ledger', wait_until='networkidle')
    phone.wait_for_timeout(500)
    assert phone.get_by_text('Groceries this month', exact=False).count() == 1
