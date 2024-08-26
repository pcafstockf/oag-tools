require('reflect-metadata');
const TSConsoleReporter = require('jasmine-ts-console-reporter');

jasmine.getEnv().clearReporters(); // Clear default console reporter
jasmine.getEnv().addReporter(new TSConsoleReporter());
jasmine.DEFAULT_TIMEOUT_INTERVAL = 30000;   // Default is just way to short.
