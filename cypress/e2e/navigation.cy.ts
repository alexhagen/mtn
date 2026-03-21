describe('Navigation', () => {
  beforeEach(() => {
    cy.visit('/')
  })

  it('should navigate to Daily Summary', () => {
    cy.contains('Daily Summary').click()
    cy.url().should('eq', Cypress.config().baseUrl + '/')
    cy.contains('Daily News Summary').should('be.visible')
  })

  it('should navigate to Reading List', () => {
    cy.contains('Reading List').click()
    cy.url().should('include', '/reading-list')
    cy.contains('Reading List').should('be.visible')
  })

  it('should navigate to Books', () => {
    cy.contains('Books').click()
    cy.url().should('include', '/books')
    cy.contains('Quarterly Book Recommendations').should('be.visible')
  })

  it('should navigate to Settings', () => {
    cy.contains('Settings').click()
    cy.url().should('include', '/settings')
    cy.contains('API Configuration').should('be.visible')
  })

  it('should highlight the active tab', () => {
    cy.contains('Settings').click()
    cy.contains('Settings').parent().should('have.class', 'Mui-selected')
  })
})
