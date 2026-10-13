// CONFIRMED by Icham (Sept 2026): one fixed product per category, used
// consistently across all test cases. The sheet lists products generically
// ("Swish", "Spray", "Facial Mist") but each category has multiple real
// products in the store — these are the agreed defaults for all scenarios.

module.exports = {
  Swish: 'CILI CBD/CBG Swish', // matches button "Add to cart CILI CBD/CBG..."
  Ageless: 'CILI AGELESS Swish',
  'Facial Mist': 'CILI FACIAL MIST REFILL', // vs. BOTTLE/EMPTY variant — defaulted to Refill
  Spray: 'CILI BOOST Spray', // one of 5 spray variants — defaulted to Boost
};