import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import App from '../App';
import { AppProvider } from '../context/AppContext';
import { LanguageProvider } from '../context/LanguageContext';

const renderApp = () => {
  return render(
    <LanguageProvider>
      <AppProvider>
        <App />
      </AppProvider>
    </LanguageProvider>
  );
};

describe('CropDoctor Web PWA', () => {
  test('renders header and main screen', () => {
    renderApp();
    expect(screen.getByText(/CropDoctor/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Disease Catalog/i)[0]).toBeInTheDocument();
  });

  test('navigates to Scan screen when Scan tab is clicked', () => {
    renderApp();
    const scanNav = screen.getByText('Scan');
    fireEvent.click(scanNav);
    expect(screen.getByText(/Take a clear photo/i)).toBeInTheDocument();
  });

  test('navigates to Catalog screen when Catalog tab is clicked', () => {
    renderApp();
    const catalogNav = screen.getByText('Catalog');
    fireEvent.click(catalogNav);
    expect(screen.getByText(/Disease Catalog \(26 Diseases\)/i)).toBeInTheDocument();
  });

  test('navigates to History screen when History tab is clicked', () => {
    renderApp();
    const historyNav = screen.getByText('History');
    fireEvent.click(historyNav);
    expect(screen.getByText(/Diagnosis History/i)).toBeInTheDocument();
  });
});
