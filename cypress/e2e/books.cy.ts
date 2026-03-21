describe('Books', () => {
  beforeEach(() => {
    cy.visit('/books')
    indexedDB.deleteDatabase('mtn-db')
  })

  it('should display books page', () => {
    cy.contains('Quarterly Book Recommendations').should('be.visible')
  })

  it('should show current quarter', () => {
    const now = new Date()
    const year = now.getFullYear()
    const quarter = Math.floor(now.getMonth() / 3) + 1
    cy.contains(`${year}-Q${quarter}`).should('be.visible')
  })

  it('should have a refresh button', () => {
    cy.contains('button', 'Refresh').should('be.visible')
  })

  it('should show empty state when no books generated', () => {
    cy.contains('No book recommendations for this quarter yet').should('be.visible')
  })

  it('should show generate recommendations button', () => {
    cy.contains('button', 'Generate Recommendations').should('be.visible')
  })
})
