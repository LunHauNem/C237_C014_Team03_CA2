// Import the packages required by the application.
const express = require('express');
const mysql = require('mysql2');
const session = require('express-session');
const path = require('path');
const bcrypt = require('bcrypt');

// Create the Express application.
const app = express();

// Render will provide its own port.
// Port 3000 is used when running locally.
const PORT = process.env.PORT || 3000;


// ==========================================================
// DATABASE CONNECTION
// ==========================================================

// Connect the application to the Azure MySQL database.
const db = mysql.createConnection({
    host: 'c237-marlina-mysql.mysql.database.azure.com',
    user: 'c237_014',
    password: 'c237014@2026!',
    database: 'c237_014_team3_ca2',
    ssl: {
        rejectUnauthorized: false
    }
});

// Test the database connection when the application starts.
db.connect((error) => {
    if (error) {
        console.error('MySQL connection failed:');
        console.error(error.message);
        return;
    }

    console.log('Connected to MySQL database');
});


// ==========================================================
// EXPRESS SETTINGS
// ==========================================================

// Use EJS as the view engine.
app.set('view engine', 'ejs');

// Tell Express where the views folder is located.
app.set(
    'views',
    path.join(__dirname, 'views')
);

// Allow Express to receive data submitted through HTML forms.
app.use(
    express.urlencoded({
        extended: true
    })
);

// Allow Express to receive JSON data.
app.use(express.json());

// Allow access to CSS, JavaScript and images
// stored inside the public folder.
app.use(
    express.static(
        path.join(__dirname, 'public')
    )
);


// ==========================================================
// SESSION SETUP
// ==========================================================

// Store login information in a session.
app.use(
    session({
        secret: 'team03-library-secret',
        resave: false,
        saveUninitialized: false,

        // The session remains active for one day.
        cookie: {
            maxAge: 1000 * 60 * 60 * 24
        }
    })
);


// ==========================================================
// SHARED EJS VARIABLES
// ==========================================================

// Make session information available in all EJS pages.
app.use((req, res, next) => {
    // Provide the logged-in user to every EJS file.
    res.locals.user =
        req.session.user || null;

    // Provide one-time success and error messages.
    res.locals.successMessage =
        req.session.successMessage || null;

    res.locals.errorMessage =
        req.session.errorMessage || null;

    // Delete the messages after they have been displayed once.
    delete req.session.successMessage;
    delete req.session.errorMessage;

    next();
});


// ==========================================================
// AUTHENTICATION MIDDLEWARE
// ==========================================================

// Check whether the visitor is logged in.
function checkAuthenticated(req, res, next) {
    // Continue to the requested route when logged in.
    if (req.session.user) {
        return next();
    }

    // Store an error message for the login page.
    req.session.errorMessage =
        'Please log in to access this page.';

    // Redirect guests to the login page.
    return res.redirect('/login');
}

// Check whether the logged-in user is an administrator.
function checkAdmin(req, res, next) {
    // Allow access only when the role is admin.
    if (
        req.session.user &&
        req.session.user.role === 'admin'
    ) {
        return next();
    }

    // Store an access-denied message.
    req.session.errorMessage =
        'Admin access only.';

    // Redirect non-admin users to the homepage.
    return res.redirect('/');
}


// ==========================================================
// HOMEPAGE AND BOOK SEARCH
// ==========================================================

// Load the homepage and book-search results.
function showHomepage(req, res) {
    // Retrieve the search text from the URL.
    const search = (
        req.query.search || ''
    ).trim();

    // Retrieve the selected category from the URL.
    const selectedGenre = (
        req.query.genre || 'all'
    ).trim();

    // Start the SQL query for loading books.
    let booksSql = `
        SELECT
            b.bookId,
            b.categoryId,
            b.title,
            b.author,
            b.isbn,
            b.quantity,
            b.availableQuantity,
            b.description,
            b.image,
            c.categoryName
        FROM books b
        INNER JOIN categories c ON b.categoryId = c.categoryId
        WHERE 1=1
    `;

    // Store values used by the prepared SQL statement.
    const values = [];

    // Store WHERE conditions separately.
    const conditions = [];

    // Search by title or author.
    if (search !== '') {
        conditions.push(`
            (
                b.title LIKE ?
                OR b.author LIKE ?
            )
        `);

        const searchValue = `%${search}%`;

        values.push(
            searchValue,
            searchValue
        );
    }

    // Filter by category when a category is selected.
    if (
        selectedGenre !== '' &&
        selectedGenre !== 'all'
    ) {
        conditions.push(`
            c.categoryName = ?
        `);

        values.push(selectedGenre);
    }

    // Add the WHERE statement only when needed.
    if (conditions.length > 0) {
        booksSql += `
            WHERE ${conditions.join(' AND ')}
        `;
    }

    // Show the newest books first.
    booksSql += `
        ORDER BY b.bookId DESC
    `;

    // Load all categories for the dropdown menu.
    const categoriesSql = `
        SELECT
            categoryId,
            categoryName
        FROM categories
        ORDER BY categoryName ASC
    `;

    // Run the categories query first.
    db.query(
        categoriesSql,
        (categoryError, categories) => {
            if (categoryError) {
                console.error(
                    'Error loading categories:',
                    categoryError
                );

                return res.status(500).send(
                    'Unable to load the categories.'
                );
            }

            // Run the book query after loading the categories.
            db.query(
                booksSql,
                values,
                (bookError, books) => {
                    if (bookError) {
                        console.error(
                            'Error loading books:',
                            bookError
                        );

                        return res.status(500).send(
                            'Unable to load the books.'
                        );
                    }

                    // Display the homepage.
                    return res.render('home', {
                        pageTitle: 'Home',
                        books: books,
                        categories: categories,
                        search: search,
                        selectedGenre: selectedGenre,
                        user:
                            req.session.user || null
                    });
                }
            );
        }
    );
}

// Display the homepage.
app.get('/', showHomepage);

// Display filtered or searched books.
app.get('/books', showHomepage);


// ==========================================================
// BOOK DESCRIPTION PAGE
// ==========================================================

// Display one book using its book ID.
app.get('/book/:bookId', (req, res) => {
    // Convert the book ID from text to an integer.
    const bookId = Number.parseInt(
        req.params.bookId,
        10
    );

    // Reject an invalid book ID.
    if (
        !Number.isInteger(bookId) ||
        bookId <= 0
    ) {
        return res.status(404).render(
            'bookNotFound',
            {
                pageTitle: 'Book Not Found'
            }
        );
    }

    // Retrieve the selected book and its category.
    const sql = `
        SELECT
            b.bookId,
            b.categoryId,
            b.title,
            b.author,
            b.isbn,
            b.quantity,
            b.availableQuantity,
            b.description,
            b.image,
            c.categoryName
        FROM books b
        INNER JOIN categories c ON b.categoryId = c.categoryId
        WHERE b.bookId = ?
    `;

    db.query(sql, [bookId], (error, results) => {
        if (error) {
            console.error('Error loading book:', error);
            return res.status(500).send('Unable to load this book.');
        }

            // Display the not-found page when no book exists.
            if (results.length === 0) {
                return res.status(404).render(
                    'bookNotFound',
                    {
                        pageTitle:
                            'Book Not Found'
                    }
                );
            }

            // Display the selected book.
            return res.render(
                'bookDescription',
                {
                    pageTitle:
                        results[0].title,
                    book: results[0]
                }
            );
        }
    );
});


// ==========================================================
// TEMPORARY BORROW ROUTE
// ==========================================================

// Only logged-in users are allowed to borrow books.
// The complete borrowing feature can replace this route later.
app.post(
    '/borrow/:bookId',
    checkAuthenticated,
    (req, res) => {
        res.send(`
            <h2>Borrowing function not connected yet.</h2>
            <p>Selected book ID: ${req.params.bookId}</p>
            <a href="/">Return to homepage</a>
        `);
    }
);


// ==========================================================
// REGISTRATION
// ==========================================================

// Display the registration page.
app.get('/register', (req, res) => {
    // Logged-in users do not need to register again.
    if (req.session.user) {
        return res.redirect('/');
    }

    return res.render('register', {
        pageTitle: 'Register',
        formData: {}
    });
});

// Process registration form submission.
app.post('/register', async (req, res) => {
    // Retrieve values submitted by the registration form.
    const {
        name,
        email,
        role,
        password,
        confirmPassword
    } = req.body;

    // Preserve the name and email if validation fails.
    const formData = {
        name: name || '',
        email: email || '',
        role: role || ''
    };

    // Check whether all fields were completed.
    if (
        !name ||
        !email ||
        !role ||
        !password ||
        !confirmPassword
    ) {
        return res.status(400).render(
            'register',
            {
                pageTitle: 'Register',
                errorMessage:
                    'All fields are required.',
                successMessage: null,
                formData: formData
            }
        );
    }

    // Remove spaces around the name.
    const cleanName = name.trim();

    // Convert the email to lowercase.
    const normalizedEmail =
        email.trim().toLowerCase();

    // Only allow the roles supported by the database ENUM.
    const allowedRoles = [
        'member',
        'admin'
    ];

    // Reject an invalid or changed role value.
    if (!allowedRoles.includes(role)) {
        return res.status(400).render(
            'register',
            {
                pageTitle: 'Register',
                errorMessage:
                    'Please select a valid account role.',
                successMessage: null,
                formData: formData
            }
        );
    }

    // Validate the member's name.
    if (cleanName.length < 2) {
        return res.status(400).render(
            'register',
            {
                pageTitle: 'Register',
                errorMessage:
                    'Name must contain at least 2 characters.',
                successMessage: null,
                formData: formData
            }
        );
    }

    // Require a password with at least six characters.
    if (password.length < 6) {
        return res.status(400).render(
            'register',
            {
                pageTitle: 'Register',
                errorMessage:
                    'Password must contain at least 6 characters.',
                successMessage: null,
                formData: formData
            }
        );
    }

    // Ensure both password fields match.
    if (password !== confirmPassword) {
        return res.status(400).render(
            'register',
            {
                pageTitle: 'Register',
                errorMessage:
                    'Passwords do not match.',
                successMessage: null,
                formData: formData
            }
        );
    }

    // Check whether the email already exists.
    const checkEmailSql = `
        SELECT userId
        FROM users
        WHERE email = ?
    `;

    db.query(
        checkEmailSql,
        [normalizedEmail],
        async (error, results) => {
            if (error) {
                console.error(
                    'Error checking email:',
                    error
                );

                return res.status(500).render(
                    'register',
                    {
                        pageTitle: 'Register',
                        errorMessage:
                            'Unable to register at the moment.',
                        successMessage: null,
                        formData: formData
                    }
                );
            }

            // Stop when the email is already registered.
            if (results.length > 0) {
                return res.status(400).render(
                    'register',
                    {
                        pageTitle: 'Register',
                        errorMessage:
                            'This email is already registered.',
                        successMessage: null,
                        formData: formData
                    }
                );
            }

            try {
                // Securely hash the password before saving it.
                const hashedPassword =
                    await bcrypt.hash(
                        password,
                        10
                    );

                // Insert the new account as a member.
                const insertUserSql = `
                    INSERT INTO users
                    (
                        name,
                        email,
                        password,
                        role
                    )
                    VALUES (?, ?, ?, ?)
                `;

                db.query(
                    insertUserSql,
                    [
                        cleanName,
                        normalizedEmail,
                        hashedPassword,
                        role
                    ],
                    (insertError) => {
                        if (insertError) {
                            console.error(
                                'Registration error:',
                                insertError
                            );

                            return res
                                .status(500)
                                .render(
                                    'register',
                                    {
                                        pageTitle:
                                            'Register',
                                        errorMessage:
                                            'Registration failed.',
                                        successMessage:
                                            null,
                                        formData:
                                            formData
                                    }
                                );
                        }

                        // Show a success message on the login page.
                        req.session.successMessage =
                            'Registration successful. Please log in.';

                        return res.redirect('/login');
                    }
                );
            } catch (hashError) {
                console.error(
                    'Password hashing error:',
                    hashError
                );

                return res.status(500).render(
                    'register',
                    {
                        pageTitle: 'Register',
                        errorMessage:
                            'Registration failed.',
                        successMessage: null,
                        formData: formData
                    }
                );
            }
        }
    );
});


// ==========================================================
// LOGIN
// ==========================================================

// Display the login page.
app.get('/login', (req, res) => {
    // Redirect users who are already logged in.
    if (req.session.user) {
        return res.redirect('/');
    }

    return res.render('login', {
        pageTitle: 'Login'
    });
});

// Process the login form.
app.post('/login', (req, res) => {
    // Retrieve the submitted login details.
    const {
        email,
        password
    } = req.body;

    // Validate the submitted fields.
    if (!email || !password) {
        return res.status(400).render(
            'login',
            {
                pageTitle: 'Login',
                errorMessage:
                    'Email and password are required.',
                successMessage: null
            }
        );
    }

    // Standardise the email format.
    const normalizedEmail =
        email.trim().toLowerCase();

    // Find the user using their email address.
    const sql = `
        SELECT
            userId,
            name,
            email,
            password,
            role
        FROM users
        WHERE email = ?
    `;

    db.query(
        sql,
        [normalizedEmail],
        async (error, results) => {
            if (error) {
                console.error(
                    'Login database error:',
                    error
                );

                return res.status(500).render(
                    'login',
                    {
                        pageTitle: 'Login',
                        errorMessage:
                            'Unable to log in at the moment.',
                        successMessage: null
                    }
                );
            }

            // Use a general error message for an unknown email.
            if (results.length === 0) {
                return res.status(401).render(
                    'login',
                    {
                        pageTitle: 'Login',
                        errorMessage:
                            'Invalid email or password.',
                        successMessage: null
                    }
                );
            }

            const user = results[0];

            try {
                // Compare the entered password with the stored hash.
                const passwordMatches =
                    await bcrypt.compare(
                        password,
                        user.password
                    );

                // Reject an incorrect password.
                if (!passwordMatches) {
                    return res.status(401).render(
                        'login',
                        {
                            pageTitle: 'Login',
                            errorMessage:
                                'Invalid email or password.',
                            successMessage: null
                        }
                    );
                }

                // Store only the required user information.
                // Do not store the password in the session.
                req.session.user = {
                    userId: user.userId,
                    name: user.name,
                    email: user.email,
                    role: user.role
                };

                // Store a one-time welcome message.
                req.session.successMessage =
                    `Welcome back, ${user.name}!`;

                // Send administrators to the admin dashboard.
                if (user.role === 'admin') {
                    return res.redirect('/admin');
                }

                // Send members to the homepage.
                return res.redirect('/member-dashboard');
            } catch (compareError) {
                console.error(
                    'Password comparison error:',
                    compareError
                );

                return res.status(500).render(
                    'login',
                    {
                        pageTitle: 'Login',
                        errorMessage:
                            'Unable to log in.',
                        successMessage: null
                    }
                );
            }
        }
    );
});


// ==========================================================
// LOGOUT
// ==========================================================

// Log out the current user.
app.get('/logout', (req, res) => {
    // Remove all session information.
    req.session.destroy((error) => {
        if (error) {
            console.error(
                'Logout error:',
                error
            );

            return res.status(500).send(
                'Unable to log out.'
            );
        }

        // Delete the session cookie.
        res.clearCookie('connect.sid');

        // Return to the public homepage.
        return res.redirect('/');
    });
});

// ==========================================================
// MEMBER DASHBOARD
// ==========================================================

// Only logged-in members can access this page.
app.get(
    '/member-dashboard',
    checkAuthenticated,
    (req, res) => {
        // Prevent administrators from accessing
        // the member dashboard.
        if (req.session.user.role !== 'member') {
            req.session.errorMessage =
                'Member access only.';

            return res.redirect('/admin');
        }

        // Temporary page until memberDashboard.ejs is created.
        return res.send(`
            <h2>Member Dashboard</h2>
            <p>Welcome, ${req.session.user.name}.</p>
            <a href="/">Return to homepage</a>
        `);
    }
);

// ==========================================================
// ADMIN DASHBOARD
// ==========================================================

// Only authenticated administrators can access this route.
app.get(
    '/admin',
    checkAuthenticated,
    checkAdmin,
    (req, res) => {
        return res.send(`
            <h2>Admin Dashboard</h2>
            <p>Welcome, ${req.session.user.name}.</p>
            <a href="/">Return to homepage</a>
        `);
    }
);


// ==========================================================
// PAGE NOT FOUND
// ==========================================================

// This must remain after all other application routes.
app.use((req, res) => {
    res.status(404).send(`
        <h2>Page Not Found</h2>
        <p>The requested page does not exist.</p>
        <a href="/">Return to homepage</a>
    `);
});



// ==========================================================
// START SERVER
// ==========================================================

// Start the Express server.
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});