// Maps each country to the exact text shown on its saved "Ship to" radio
// button, and the flag/currency label shown in the country switcher.
// These addresses are already saved on affiliate account 1167091 —
// no new-address entry needed for any of these 10 countries.

module.exports = {
  France: {
    addressRadioText: "Ich Ben, 10 Chemin d",
    flagLabel: 'France ( € )',
    isDefault: true, // already selected by default at checkout — may not need "Ship to" click
  },
  Netherlands: {
    addressRadioText: 'Jan de Vries, Damrak 45',
    flagLabel: 'Netherlands ( € )',
  },
  Belgium: {
    addressRadioText: 'Pierre Lambert, Rue Neuve 30',
    flagLabel: 'Belgium ( € )',
  },  
  Germany: {
    addressRadioText: 'Hans Müller, Alexanderplatz 5',
    flagLabel: 'Germany ( € )',
  },
  Denmark: {
    addressRadioText: 'Lars Nielsen, Strøget 12',
    flagLabel: 'Denmark ( kr )',
  },
  Norway: {
    addressRadioText: 'Ola Hansen, Karl Johans gate 22',
    flagLabel: 'Norway ( kr )',
  },
  Austria: {
    addressRadioText: 'Franz Gruber, Kärntner Straße 10',
    flagLabel: 'Austria ( € )',
  },
  Switzerland: {
    addressRadioText: 'Hans Keller, Bahnhofstrasse 15',
    flagLabel: 'Switzerland ( CHF )',
  },
  'United Kingdom': {
    addressRadioText: 'James Smith, 10 Oxford Street',
    flagLabel: 'United Kingdom ( £ )',
  },
  Poland: {
    addressRadioText: 'Jan Kowalski, ul. Marszałkowska 20',
    flagLabel: 'Poland ( zł )',
  },
};
