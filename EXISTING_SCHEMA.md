# Existing MSSQL Database Schema

## FrumShared Database

### BlogEntries (34,295 rows) - Main Q&A Content
| Column | Type | Notes |
|--------|------|-------|
| BlogEntryID | int | Primary key |
| UID | int | User ID reference |
| Active | bit | Is active |
| BlogImage | nvarchar(50) | Image filename |
| BlogCategoryID | int | Category (98 = Ask Rabbi) |
| BlogEntryDate | float | Excel serial date format |
| BlogEntryTitle | nvarchar(255) | Title |
| BlogEntryText | nvarchar(max) | Full HTML content |
| BlogPictureURL | nvarchar(150) | Picture URL |
| BlogPicture | nvarchar(100) | Picture filename |
| BlogCount | int | View count |
| AllowComments | bit | Comments enabled |
| OnHold | bit | Pending moderation |
| SendAlert | bit | Send email alert |
| Advertisement | bit | Is advertisement |
| Email | nvarchar(50) | Submitter email |
| CompanyID | int | Business reference |
| LondonFlag | bit | For London site |

### BlogCategories (63 rows)
- BlogCategoryID, BlogCategoryName, Active, ActiveToronto, etc.
- Used to filter content types

### BlogUserComments (561 rows)
- BlogCommentID, BlogEntryID, BlogCommentName, BlogCommentEmail, BlogCommentText

---

## FrumToronto Database

### DirectoryListings (1,814 rows) - Business Directory
| Column | Type | Notes |
|--------|------|-------|
| ID | int | Primary key |
| Active | bit | Is active |
| Minyan | bit | Has minyan |
| Latitude | float | Map coordinate |
| Longitude | float | Map coordinate |
| ShomerShabbos | bit | Sabbath observant |
| ShowListing | bit | Publicly visible |
| PrivateListing | bit | Private |
| Trusted | bit | Verified business |
| EndDate | int | Subscription end (Excel date) |
| BaseID | int | Base plan ID |
| HostingID | int | Hosting plan reference |
| Tag1-Tag14 | bit | Category tags |
| CategoryID1-6 | int | Category references |
| Company | nvarchar(100) | Business name |
| Slogan | nvarchar(150) | Business slogan |
| ShortDescription | nvarchar(150) | Brief description |
| Description | nvarchar(max) | Full description |
| Address | nvarchar(50) | Street address |
| Unit | nvarchar(50) | Unit number |
| City | nvarchar(50) | City |
| Province | nvarchar(25) | Province/State |
| PostalCode | nvarchar(10) | Postal code |
| Country | nvarchar(25) | Country |
| PhoneNumber | nvarchar(40) | Phone |
| PhoneNumber2 | nvarchar(40) | Alt phone |
| FaxNumber | nvarchar(40) | Fax |
| CellNumber | nvarchar(40) | Cell |
| WebUrl | nvarchar(100) | Website |
| Email | nvarchar(75) | Email |
| Password | nvarchar(20) | **PLAIN TEXT PASSWORD** |
| ContactName | nvarchar(100) | Contact person |
| Keywords | nvarchar(255) | Search keywords |
| Photo1 | nvarchar(255) | Photo filename |
| Comments | nvarchar(max) | Admin comments |

### DirectoryCategories (438 rows)
| Column | Type | Notes |
|--------|------|-------|
| ID | int | Primary key |
| CategoryName | nvarchar(150) | Display name |
| Group1-4 | int | Parent group refs |
| DCount | int | Listing count |
| JewishActive | bit | Jewish category |
| Important | bit | Featured category |

### DirectoryGroups (16 rows)
- Main category groups (Business Services, Kosher Foods, etc.)

### Classified (1,660 rows)
| Column | Type | Notes |
|--------|------|-------|
| ID | int | Primary key |
| UID | float | User ID |
| ClassifiedCategory | nvarchar(255) | Category name |
| CategoryID | int | Category reference |
| ClassifiedTitle | nvarchar(255) | Title |
| ClassifiedDetails | nvarchar(max) | Full content |
| StartDte | float | Start date (Excel format) |
| EndDte | float | End date |
| OnHold | bit | Pending moderation |
| Email | nvarchar(255) | Contact email |
| ClassifiedPicture | nvarchar(255) | Picture filename |

### Diary (6,016 rows) - Calendar Events
| Column | Type | Notes |
|--------|------|-------|
| id | int | Primary key |
| UID | float | User ID |
| dte | int | Event date |
| eTime | nvarchar(50) | Event time |
| text_field | nvarchar(255) | Title |
| Category | int | Category reference |
| ProjectBy | int | Organizer |
| Address | int | Location reference |
| OtherLocation | nvarchar(100) | Custom location |
| OtherAddress | nvarchar(100) | Custom address |
| ContactName | nvarchar(100) | Contact |
| ContactNumber | nvarchar(100) | Phone |
| ContactEmail | nvarchar(70) | Email |
| ContactURL | nvarchar(255) | Website |
| Cost | nvarchar(150) | Event cost |
| Details | nvarchar(max) | Description |
| Image | nvarchar(100) | Image filename |
| onhold | bit | Pending moderation |

### Diary_Categorys (7 rows)
- Cat_ID, Category, Colour, BgColour, Mailer

### DiaryShiurim (282 rows) - Weekly Classes
| Column | Type | Notes |
|--------|------|-------|
| ID | int | Primary key |
| Title | nvarchar(255) | Class title |
| TFirstName | nvarchar(255) | Teacher first name |
| TLastName | nvarchar(255) | Teacher last name |
| Details | nvarchar(max) | Description |
| LocID | int | Location reference |
| SundayHour/Minute | int | Time per day |
| MondayHour/Minute | int | |
| etc... | | Per day of week |
| ClassType | nvarchar(100) | Type of shiur |
| Category | nvarchar(100) | Topic category |
| eLevel | nvarchar(50) | Level |
| MF | nvarchar(50) | Men/Women |
| Cost | nvarchar(70) | Cost |
| OnHold | bit | Pending |

### DaveningSchedule (734 rows)
| Column | Type | Notes |
|--------|------|-------|
| DSID | int | Primary key |
| ID | int | Shul reference (DirectoryListings) |
| TefilahType | nvarchar(50) | shacharis/mincha/maariv |
| Times | nvarchar(50) | Time |
| TimeAdjust | nvarchar(50) | Relative time |
| Winter | bit | Winter schedule |
| Summer | bit | Summer schedule |
| Sunday-Shabbos | bit | Days applicable |

### MemberList (3,264 rows) - Email Subscribers
| Column | Type | Notes |
|--------|------|-------|
| MemberID | int | Primary key |
| Active | bit | Active subscriber |
| Email | nvarchar(75) | Email address |
| Password | nvarchar(30) | **PLAIN TEXT** |
| FirstName | nvarchar(50) | Name |
| LastName | nvarchar(50) | Name |
| KosherAlerts | bit | Subscribe to alerts |
| EruvStatus | bit | Subscribe to eruv |
| Simchas | bit | Subscribe to simchas |
| Condolences | bit | Subscribe to shiva |
| OmerReminder | bit | Omer count emails |

### Members (12 rows) - Admin Users
| Column | Type | Notes |
|--------|------|-------|
| MemberID | int | Primary key |
| SuperAdmin | bit | Super admin |
| Admin | bit | Admin |
| BlogAdmin | bit | Blog admin |
| EruvUser | bit | Can update eruv |
| Email | nvarchar(75) | Login email |
| Password | nvarchar(10) | **PLAIN TEXT** |

### HostingPlans (14 rows) - Subscription Plans
- PlanID, Rate (money), HostingPlanName, HostingPlanDescription

### Locations (20 rows)
- ID, Location name, Davening flag, Shiurim flag

### TicketTracker (43,362 rows) - Contact Submissions
- Support tickets and contact form submissions

### Advertisements (83 rows)
- Banner ad configuration

---

## Key Migration Challenges

### 1. Date Format
- Uses Excel serial date format (float)
- Need to convert: `=DATEVALUE("1899-12-30") + float_value`
- JavaScript: `new Date((float - 25569) * 86400 * 1000)`

### 2. Passwords
- **CRITICAL**: All passwords stored in plain text
- Fresh start approach: Users must create new accounts
- Migration will NOT import passwords

### 3. Image Files
- Stored as filenames only (e.g., "photo123.jpg")
- Need to determine server path for existing images
- Migrate to Vercel Blob storage

### 4. Category System
- Uses Tag1-Tag14 boolean flags + CategoryID1-6
- Need to normalize to proper many-to-many relationship

### 5. Location References
- Shuls are in DirectoryListings (filter by Minyan=1 or category)
- DaveningSchedule.ID references DirectoryListings.ID

---

## Data to Migrate

| Source Table | Target (Neon) | Records | Priority |
|--------------|---------------|---------|----------|
| BlogEntries (CategoryID=98) | ask_the_rabbi | ~5,000+ | High |
| DirectoryListings | businesses | 1,814 | High |
| DirectoryCategories | business_categories | 438 | High |
| Classified | classifieds | 1,660 | High |
| Diary | events | 6,016 | Medium |
| DiaryShiurim | shiurim | 282 | Medium |
| DaveningSchedule | davening_schedules | 734 | High |
| MemberList | (email only) | 3,264 | Low |
| Members | (skip - new auth) | 12 | Skip |

---

## Image Locations to Investigate

Need to ask client where images are stored:
- `/images/directory/` ?
- `/images/classifieds/` ?
- `/images/blog/` ?

Images need to be migrated to Vercel Blob.
