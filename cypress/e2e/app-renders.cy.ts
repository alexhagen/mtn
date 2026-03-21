describe('App Renders', () => {
  it('should display the navigation bar', () => {
    cy.visit('/')
    cy.contains('Multi-Timescale News').should('be.visible')
  })

  it('should have all 4 navigation tabs', () => {
    cy.visit('/')
    cy.contains('Daily Summary').should('be.visible')
    cy.contains('Reading List').should('be.visible')
    cy.contains('Books').should('be.visible')
    cy.contains('Settings').should('be.visible')
  })

  it('should not have a blank screen', () => {
    cy.visit('/')
    cy.get('body').should('not.be.empty')
    cy.get('#root').should('not.be.empty')
  })
})
