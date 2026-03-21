describe('Daily Summary', () => {
  beforeEach(() => {
    // Clear IndexedDB before each test
    indexedDB.deleteDatabase('mtn-db')
  })

  it('should show configure settings prompt when no settings exist', () => {
    cy.visit('/')
    cy.contains('Please configure at least one topic in Settings').should('be.visible')
  })

  it('should show topic tabs when settings are configured', () => {
    // Set up settings via IndexedDB
    cy.visit('/settings')
    
    // Add API key
    cy.get('input[type="password"]').type('test-api-key')
    
    // Add CORS proxy
    cy.contains('CORS Proxy URL').parent().find('input').clear().type('https://test.workers.dev')
    
    // Add a topic
    cy.get('input[value=""]').first().type('Technology')
    cy.contains('button', 'Add').first().click()
    
    // Save settings
    cy.contains('button', 'Save Settings').click()
    cy.contains('Settings saved successfully!').should('be.visible')
    
    // Navigate to Daily Summary
    cy.contains('Daily Summary').click()
    
    // Should show the topic name
    cy.contains('Technology').should('be.visible')
  })

  it('should have a refresh button', () => {
    cy.visit('/')
    cy.contains('button', 'Refresh').should('exist')
  })

  it('should show generate summary button when no summary exists', () => {
    // Set up minimal settings
    cy.visit('/settings')
    cy.get('input[type="password"]').type('test-api-key')
    cy.contains('CORS Proxy URL').parent().find('input').clear().type('https://test.workers.dev')
    cy.get('input[value=""]').first().type('Technology')
    cy.contains('button', 'Add').first().click()
    cy.contains('button', 'Save Settings').click()
    
    cy.visit('/')
    cy.contains('No summary available').should('be.visible')
    cy.contains('button', 'Generate Summary').should('be.visible')
  })
})
