## ADDED Requirements

### Requirement: Product Record Structure
The system SHALL store products with a name, an optional description, an optional unique selling point (USP), an optional price, an optional image, and a status (active/discontinued).

#### Scenario: Creating a product with minimum fields
- **WHEN** a user creates a product with only a name
- **THEN** the product is saved with empty description, USP, price, and image, and status defaults to active

#### Scenario: Creating a product with full details
- **WHEN** a user creates a product with name, description, USP, price, and an uploaded image
- **THEN** all fields are saved and the product appears in the product list

### Requirement: Product CRUD API
The system SHALL provide an API endpoint to list, create, update, and delete products, scoped to the authenticated user's tenant.

#### Scenario: Listing products returns only the current tenant's products
- **WHEN** a user requests the product list
- **THEN** only products belonging to their tenant are returned

#### Scenario: Deleting a referenced product does not break existing campaigns
- **WHEN** a product that is already referenced by an email campaign is deleted
- **THEN** the campaign is not deleted and its stored product reference is not treated as an error

### Requirement: Bootstrap Products From Brand Context
The system SHALL provide a one-time migration/script that parses the product/service list already present in the tenant's `brand_md` brand context and creates one product row per listed item.

#### Scenario: Bootstrap creates one product per listed item
- **WHEN** the bootstrap script runs against a brand context containing a "รายละเอียด สินค้า/บริการ" list of N items
- **THEN** N product rows are created, each with the item's name and description text

#### Scenario: Bootstrap auto-links a matching product reference image
- **WHEN** a bootstrapped product's name exactly matches the name of an entry in the tenant's existing product reference images
- **THEN** the matching image is set as the product's image

#### Scenario: Bootstrap leaves image empty when no match exists
- **WHEN** a bootstrapped product's name does not match any existing product reference image
- **THEN** the product is created with no image, and no error is raised

### Requirement: Product Management UI
The system SHALL provide a UI section (on the existing Brand Setting page) where users can view, add, edit, and delete products, including uploading or changing a product's image.

#### Scenario: User completes a bootstrapped product
- **WHEN** a user opens a product that was created by the bootstrap script without a price
- **THEN** the user can add a price and save the change

#### Scenario: User adds a brand-new product
- **WHEN** a user adds a product that was not part of the brand.md bootstrap
- **THEN** the new product is saved and becomes available for selection in campaign generation
