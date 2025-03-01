/**
 * This file is for the sole purpose of keeping the various FrameworkUtils implementations happy.
 * data-mocking.ts will ultimately be copied into the same directory as framework-utils.ts, so this
 * allows us to just do "import {xxx} from './data-mocking' in those template implementations.
 */
export * from '../../support/data-mocking';
