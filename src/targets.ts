/** Sites under test. */

/**
 * W3C WAI "Before and After Demonstration" (BAD): an intentionally inaccessible site ("before")
 * and its repaired version ("after"). https://www.w3.org/WAI/demos/bad/
 */
const BAD = 'https://www.w3.org/WAI/demos/bad';

export const W3C_BAD = {
  before: {
    home: `${BAD}/before/home.html`,
    survey: `${BAD}/before/survey.html`,
  },
  after: {
    home: `${BAD}/after/home.html`,
    survey: `${BAD}/after/survey.html`,
  },
};

/** SauceDemo — the demo e-commerce app also tested in qa-engineering-journey. */
export const SAUCE = {
  url: 'https://www.saucedemo.com',
  username: 'standard_user',
  password: 'secret_sauce',
};
