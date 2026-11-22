"""The UI's stepped motion with animations on, and US dollars as the default."""
from conftest import BASE, open_app


def test_new_food_drops_onto_the_shelf_and_settles(phone_live):
    open_app(phone_live)
    phone_live.goto(BASE + '/review?manual=1', wait_until='networkidle')
    name = phone_live.get_by_label('Item name').first
    name.fill('Ghost pepper')
    name.press('Tab')
    phone_live.get_by_text('Confirm & stock fridge', exact=True).click()
    phone_live.get_by_test_id('door-fridge').click()
    tile = phone_live.get_by_label('Ghost pepper', exact=False).first
    tile.wait_for(timeout=5000)
    phone_live.wait_for_timeout(1200)  # the drop is ~0.3 s
    assert tile.is_visible()


def test_screens_step_in_without_losing_what_was_typed(phone_live):
    open_app(phone_live)
    phone_live.get_by_role('tab', name='Plan').click()
    field = phone_live.get_by_label('Item to buy')
    field.fill('Pumpkin spice')
    phone_live.get_by_role('tab', name='Ledger').click()
    phone_live.wait_for_timeout(600)
    assert phone_live.get_by_role('heading', name='Ledger').is_visible()
    phone_live.get_by_role('tab', name='Plan').click()
    phone_live.wait_for_timeout(600)
    # The step-in replays on the way back, but the screen isn't remounted: the half-typed item is still there.
    assert field.input_value() == 'Pumpkin spice'
    heading = phone_live.get_by_role('heading', name='Plan & shop')
    box = heading.bounding_box()
    phone_live.wait_for_timeout(300)
    assert heading.bounding_box() == box  # settled, not still moving


def test_a_fresh_install_and_the_sample_data_use_us_dollars(phone):
    open_app(phone)  # loads the sample data
    phone.goto(BASE + '/settings', wait_until='networkidle')
    assert phone.get_by_label('Default: US Dollar (USD)', exact=False).count() == 1
    assert phone.get_by_label('Display: US Dollar (USD)', exact=False).count() == 1
    phone.goto(BASE + '/ledger', wait_until='networkidle')
    phone.wait_for_timeout(500)
    body = phone.locator('body').inner_text()
    assert '$' in body and 'Rs' not in body
