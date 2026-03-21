describe('Settings', () => {
  beforeEach(() => {
    cy.visit('/settings')
    // Clear IndexedDB before each test
    indexedDB.deleteDatabase('mtn-db')
  })

  it('should display settings form', () => {
    cy.contains('API Configuration').should('be.visible')
    cy.contains('Topics').should('be.visible')
  })

  it('should allow entering API key', () => {
    cy.get('input[type="password"]').type('test-api-key')
    cy.get('input[type="password"]').should('have.value', 'test-api-key')
  })

  it('should allow entering CORS proxy URL', () => {
    cy.contains('CORS Proxy URL').parent().find('input').clear().type('https://test.workers.dev')
    cy.contains('CORS Proxy URL').parent().find('input').should('have.value', 'https://test.workers.dev')
  })

  it('should allow adding a topic', () => {
    cy.get('input[value=""]').first().type('Technology')
    cy.contains('button', 'Add').first().click()
    cy.contains('Technology').should('be.visible')
  })

  it('should limit topics to 3', () => {
    // Add 3 topics
    cy.get('input[value=""]').first().type('Topic 1')
    cy.contains('button', 'Add').first().click()
    
    cy.get('input[value=""]').first().type('Topic 2')
    cy.contains('button', 'Add').first().click()
    
    cy.get('input[value=""]').first().type('Topic 3')
    cy.contains('button', 'Add').first().click()
    
    // Try to add a 4th - button should be disabled
    cy.get('input[value=""]').first().should('be.disabled')
    cy.contains('button', 'Add').first().should('be.disabled')
  })

  it('should allow adding RSS feeds to a topic', () => {
    // Add a topic first
    cy.get('input[value=""]').first().type('Technology')
    cy.contains('button', 'Add').first().click()
    
    // Click on the topic to select it
    cy.contains('Technology').click()
    
    // Add an RSS feed
    cy.contains('RSS Feed URL').parent().find('input').type('https://example.com/feed.xml')
    cy.contains('button', 'Add').last().click()
    
    cy.contains('https://example.com/feed.xml').should('be.visible')
  })

  it('should save settings', () => {
    cy.get('input[type="password"]').type('test-api-key')
    cy.contains('button', 'Save Settings').click()
    cy.contains('Settings saved successfully!').should('be.visible')
  })
})
