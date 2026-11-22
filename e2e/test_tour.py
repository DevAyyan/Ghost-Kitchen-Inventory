"""The guided tour from the judges' link to the end, and logging food by voice (typed, as there's no mic)."""
from conftest import BASE, open_app


def _title(page, text):
    page.get_by_role('heading', name=text).wait_for(timeout=10_000)


def test_tour_runs_from_the_link_to_the_end(phone):
    phone.goto(BASE + '/?tour=1', wait_until='networkidle', timeout=120_000)
    _title(phone, 'A fridge that haunts you')
    assert phone.get_by_text('Skip', exact=True).count() == 0  # the welcome sheet steps aside for the tour
    phone.get_by_text('Next', exact=True).click()

    _title(phone, 'One photo stocks the fridge')
    phone.get_by_text('Use the sample receipt', exact=True).click()
    _title(phone, 'Nothing goes in unchecked')  # moved on by itself when the review opened
    phone.get_by_text('Confirm & stock fridge', exact=True).click()
    _title(phone, 'Log it by voice')

    for title in ['Cook what is turning first', 'Three days, nothing wasted', 'Waste you can measure', 'Rules the AI cannot bend']:
        phone.get_by_text('Next', exact=True).click()
        _title(phone, title)
    assert phone.url.endswith('/trust')
    phone.get_by_text('Finish', exact=True).click()
    phone.wait_for_timeout(300)
    assert phone.get_by_label('Guided tour').count() == 0


def test_tour_skips_review_without_a_scan_and_folds_away(phone):
    phone.goto(BASE + '/?tour=1', wait_until='networkidle', timeout=120_000)
    phone.get_by_text('Next', exact=True).click()
    _title(phone, 'One photo stocks the fridge')
    phone.get_by_text('Skip this step', exact=True).click()
    _title(phone, 'Log it by voice')
    phone.get_by_label('Fold the tour away').click()
    assert phone.get_by_text('Tour 4 of 8', exact=True).count() == 1
    assert phone.get_by_label('End the tour').count() == 0  # folded: only the pill shows


def test_telling_the_fridge_logs_food_after_confirming(phone):
    open_app(phone)
    phone.get_by_label('Tell the fridge what you used').click()
    box = phone.get_by_label('What you used or threw out')
    box.fill('used half the milk and threw out the cucumber')
    phone.get_by_text('Read it', exact=True).click()
    phone.get_by_text('Used 0.5 L of Milk', exact=False).wait_for(timeout=5000)
    assert phone.get_by_text('Bury Cucumber', exact=True).count() == 1
    phone.get_by_text('Confirm 2', exact=True).click()
    phone.get_by_text('1 used · 1 buried', exact=True).wait_for(timeout=5000)
