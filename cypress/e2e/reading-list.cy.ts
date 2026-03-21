describe('Reading List', () => {
  beforeEach(() => {
    cy.visit('/reading-list')
    indexedDB.deleteDatabase('mtn-db')
  })

  it('should display reading list page', () => {
    cy.contains('Reading List').should('be.visible')
  })

  it('should show empty state when no articles saved', () => {
    cy.contains('No articles saved for this month').should('be.visible')
  })

  it('should have a save article button', () => {
    cy.contains('button', 'Save Article').should('be.visible')
  })

  it('should show article count (0/4)', () => {
    cy.contains('Save Article (0/4)').should('be.visible')
  })

  it('should open save article dialog', () => {
    cy.contains('button', 'Save Article').click()
    cy.contains('Save Article for Later').should('be.visible')
    cy.contains('Article URL').should('be.visible')
  })

  it('should close save article dialog on cancel', () => {
    cy.contains('button', 'Save Article').click()
    cy.contains('button', 'Cancel').click()
    cy.contains('Save Article for Later').should('not.exist')
  })
})
