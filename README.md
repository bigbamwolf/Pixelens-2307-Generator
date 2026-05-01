# BIR 2307 Generator

Static GitHub Pages app for generating filled BIR Form 2307 PDFs from the saved Excel based template.

## How to deploy

1. Upload all files in this folder to a GitHub repository.
2. Keep the folder structure exactly the same.
3. Turn on GitHub Pages for the repository.
4. Open `index.html` through the GitHub Pages link.

## How it works

The app loads:

* `assets/2307_template.xlsx` as the saved Excel source template.
* `assets/2307_template_blank.pdf` as the preserved visual PDF template used for the final downloadable output.
* `data/suppliers.json` as the visible tab supplier database.

The user inputs supplier name, month, year, amount, and optional ZIP code. The app then:

* Finds supplier name, TIN, and address from the database.
* Detects the quarter from the month.
* Places the gross amount in the correct month column.
* Computes 2 percent withholding tax.
* Downloads a filled PDF.

## Notes

Hidden tabs were intentionally not included in the supplier database.

June ends at 30 days. The app uses the actual last day of the month for quarter end dates.
