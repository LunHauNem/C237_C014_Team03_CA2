CALISTA - HOMEPAGE & BOOK DESCRIPTION CODE PACK

FILES
1. Copy views/home.ejs into your project's views folder.
2. Copy views/bookDescription.ejs into your views folder.
3. Copy views/bookNotFound.ejs into your views folder.
4. Copy views/partials/header.ejs and footer.ejs into views/partials.
5. Copy public/css/style.css into public/css.
6. Put all book-cover files in public/images.

BOOK IMAGE FILENAMES FROM THE SQL SAMPLE DATA
- harrypotter.jpg
- cleancode.jpg
- clrs.jpg
- atomichabits.jpg
- sapiens.jpg

Also add a fallback image:
- public/images/default-book.jpg

APP.JS
Open app-routes.js and paste both routes into app.js after the database
connection and before app.listen(...).

The code assumes the connection variable is called:
db

If your team's variable is called:
connection

replace:
db.query

with:
connection.query

TEAM INTEGRATION
- Ashlee owns header.ejs, so she can merge or restyle the supplied navbar.
- Cy owns search/filter. The homepage search form sends GET /books?search=...
  so Cy can connect that route.
- The book page's Borrow button sends POST /borrow/:bookId. Connect it to
  the team's final borrow route when that feature is ready.
