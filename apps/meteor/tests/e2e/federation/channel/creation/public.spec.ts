import faker from '@faker-js/faker';

import { test, expect } from '../../utils/test';
import { FederationChannel } from '../../page-objects/channel';
import * as constants from '../../config/constants';
import { registerUser } from '../../utils/register-user';
import { formatIntoFullMatrixUsername, formatUsernameAndDomainIntoMatrixFormat } from '../../utils/format';
import { doLogin } from '../../utils/auth';
import { createChannelAndInviteRemoteUserToCreateLocalUser } from '../../utils/channel';

test.describe.parallel('Federation - Channel Creation', () => {
	let poFederationChannelServer1: FederationChannel;
	let userFromServer2UsernameOnly: string;
	let userFromServer1UsernameOnly: string;
	let createdChannelName: string;

	test.beforeAll(async ({ apiServer1, apiServer2, browser }) => {
		userFromServer1UsernameOnly = await registerUser(apiServer1);
		userFromServer2UsernameOnly = await registerUser(apiServer2);
		const page = await browser.newPage();
		poFederationChannelServer1 = new FederationChannel(page);
		createdChannelName = await createChannelAndInviteRemoteUserToCreateLocalUser({
			page,
			poFederationChannelServer1,
			userFromServer2UsernameOnly,
		});
	});

	test.beforeEach(async ({ page }) => {
		poFederationChannelServer1 = new FederationChannel(page);
		await doLogin({
			page,
			server: {
				url: constants.RC_SERVER_1.url,
				username: constants.RC_SERVER_1.username,
				password: constants.RC_SERVER_1.password,
			},
		});

		await page.addInitScript(() => {
			window.localStorage.setItem('fuselage-localStorage-members-list-type', JSON.stringify('online'));
		});
	});

	test.afterEach(async ({ page }) => {
		await poFederationChannelServer1.sidenav.logout();
		await page.close();
	});

	test.describe('Channel (Public)', () => {
		test.describe('Inviting users using the creation modal', () => {
			test('expect to create a channel inviting an user from the Server B who does not exist in Server A yet', async ({
				browser,
				apiServer2,
				page,
			}) => {
				const pageForServer2 = await browser.newPage();
				const poFederationChannelServer2 = new FederationChannel(pageForServer2);
				const channelName = faker.datatype.uuid();
				const usernameFromServer2 = await registerUser(apiServer2);

				await doLogin({
					page: pageForServer2,
					server: {
						url: constants.RC_SERVER_2.url,
						username: usernameFromServer2,
						password: constants.RC_SERVER_2.password,
					},
					storeState: false,
				});

				await page.goto(`${constants.RC_SERVER_1.url}/home`);
				await pageForServer2.goto(`${constants.RC_SERVER_2.url}/home`);

				const fullUsernameFromServer2 = formatIntoFullMatrixUsername(usernameFromServer2, constants.RC_SERVER_2.matrixServerName);
				const usernameWithDomainFromServer2 = formatUsernameAndDomainIntoMatrixFormat(
					usernameFromServer2,
					constants.RC_SERVER_2.matrixServerName,
				);
				const usernameWithDomainFromServer1 = formatUsernameAndDomainIntoMatrixFormat(
					constants.RC_SERVER_1.username,
					constants.RC_SERVER_1.matrixServerName,
				);

				await poFederationChannelServer1.createPublicChannelAndInviteUsersUsingCreationModal(channelName, [fullUsernameFromServer2]);

				await expect(page).toHaveURL(`${constants.RC_SERVER_1.url}/channel/${channelName}`);

				await poFederationChannelServer1.sidenav.openChat(channelName);
				await poFederationChannelServer1.tabs.btnTabMembers.click();
				await poFederationChannelServer1.tabs.members.showAllUsers();

				await poFederationChannelServer2.sidenav.openChat(channelName);
				await poFederationChannelServer2.tabs.btnTabMembers.click();
				await poFederationChannelServer2.tabs.members.showAllUsers();

				await expect(poFederationChannelServer1.tabs.members.getUserInList(usernameWithDomainFromServer2)).toBeVisible();
				await expect(poFederationChannelServer1.tabs.members.getUserInList(constants.RC_SERVER_1.username)).toBeVisible();

				await expect(poFederationChannelServer2.tabs.members.getUserInList(usernameFromServer2)).toBeVisible();
				await expect(poFederationChannelServer2.tabs.members.getUserInList(usernameWithDomainFromServer1)).toBeVisible();
				await pageForServer2.close();
			});

			test('expect to create a channel inviting an user from the Server B who already exist in Server A', async ({ browser, page }) => {
				const pageForServer2 = await browser.newPage();
				const poFederationChannelServer2 = new FederationChannel(pageForServer2);
				const channelName = faker.datatype.uuid();

				await doLogin({
					page: pageForServer2,
					server: {
						url: constants.RC_SERVER_2.url,
						username: userFromServer2UsernameOnly,
						password: constants.RC_SERVER_2.password,
					},
					storeState: false,
				});

				await page.goto(`${constants.RC_SERVER_1.url}/home`);
				await pageForServer2.goto(`${constants.RC_SERVER_2.url}/home`);

				const usernameWithDomainFromServer2 = formatUsernameAndDomainIntoMatrixFormat(
					userFromServer2UsernameOnly,
					constants.RC_SERVER_2.matrixServerName,
				);
				const usernameWithDomainFromServer1 = formatUsernameAndDomainIntoMatrixFormat(
					constants.RC_SERVER_1.username,
					constants.RC_SERVER_1.matrixServerName,
				);

				await poFederationChannelServer1.createPublicChannelAndInviteUsersUsingCreationModal(channelName, [userFromServer2UsernameOnly]);

				await expect(page).toHaveURL(`${constants.RC_SERVER_1.url}/channel/${channelName}`);

				await poFederationChannelServer1.sidenav.openChat(channelName);
				await poFederationChannelServer1.tabs.btnTabMembers.click();
				await poFederationChannelServer1.tabs.members.showAllUsers();

				await poFederationChannelServer2.sidenav.openChat(channelName);
				await poFederationChannelServer2.tabs.btnTabMembers.click();
				await poFederationChannelServer2.tabs.members.showAllUsers();

				await expect(poFederationChannelServer1.tabs.members.getUserInList(usernameWithDomainFromServer2)).toBeVisible();
				await expect(poFederationChannelServer1.tabs.members.getUserInList(constants.RC_SERVER_1.username)).toBeVisible();

				await expect(poFederationChannelServer2.tabs.members.getUserInList(userFromServer2UsernameOnly)).toBeVisible();
				await expect(poFederationChannelServer2.tabs.members.getUserInList(usernameWithDomainFromServer1)).toBeVisible();
				await pageForServer2.close();
			});

			test.describe('With multiple users (when the remote user does not exists in the server A yet)', () => {
				const createdChannel = faker.datatype.uuid();
				let createdUsernameFromServer2: string;

				test('expect to create a channel inviting an user from the Server B who does not exist in Server A yet + an user from Server A only (locally)', async ({
					browser,
					apiServer2,
					page,
				}) => {
					const pageForServer2 = await browser.newPage();
					const poFederationChannelServer2 = new FederationChannel(pageForServer2);
					createdUsernameFromServer2 = await registerUser(apiServer2);

					await doLogin({
						page: pageForServer2,
						server: {
							url: constants.RC_SERVER_2.url,
							username: createdUsernameFromServer2,
							password: constants.RC_SERVER_2.password,
						},
						storeState: false,
					});

					await page.goto(`${constants.RC_SERVER_1.url}/home`);
					await pageForServer2.goto(`${constants.RC_SERVER_2.url}/home`);

					const fullUsernameFromServer2 = formatIntoFullMatrixUsername(createdUsernameFromServer2, constants.RC_SERVER_2.matrixServerName);
					const usernameWithDomainFromServer2 = formatUsernameAndDomainIntoMatrixFormat(
						createdUsernameFromServer2,
						constants.RC_SERVER_2.matrixServerName,
					);
					const adminUsernameWithDomainFromServer1 = formatUsernameAndDomainIntoMatrixFormat(
						constants.RC_SERVER_1.username,
						constants.RC_SERVER_1.matrixServerName,
					);
					const userCreatedWithDomainFromServer1 = formatUsernameAndDomainIntoMatrixFormat(
						userFromServer1UsernameOnly,
						constants.RC_SERVER_1.matrixServerName,
					);

					await poFederationChannelServer1.createPublicChannelAndInviteUsersUsingCreationModal(createdChannel, [
						fullUsernameFromServer2,
						userFromServer1UsernameOnly,
					]);

					await expect(page).toHaveURL(`${constants.RC_SERVER_1.url}/channel/${createdChannel}`);

					await poFederationChannelServer1.sidenav.openChat(createdChannel);
					await poFederationChannelServer1.tabs.btnTabMembers.click();
					await poFederationChannelServer1.tabs.members.showAllUsers();

					await poFederationChannelServer2.sidenav.openChat(createdChannel);
					await poFederationChannelServer2.tabs.btnTabMembers.click();
					await poFederationChannelServer2.tabs.members.showAllUsers();

					await expect(poFederationChannelServer1.tabs.members.getUserInList(usernameWithDomainFromServer2)).toBeVisible();
					await expect(poFederationChannelServer1.tabs.members.getUserInList(userFromServer1UsernameOnly)).toBeVisible();
					await expect(poFederationChannelServer1.tabs.members.getUserInList(constants.RC_SERVER_1.username)).toBeVisible();

					await expect(poFederationChannelServer2.tabs.members.getUserInList(createdUsernameFromServer2)).toBeVisible();
					await expect(poFederationChannelServer2.tabs.members.getUserInList(userCreatedWithDomainFromServer1)).toBeVisible();
					await expect(poFederationChannelServer2.tabs.members.getUserInList(adminUsernameWithDomainFromServer1)).toBeVisible();
					await pageForServer2.close();
				});

				test('expect the user from Server A (locally) is able to access the previous created channel', async ({ browser }) => {
					const page2 = await browser.newPage();
					const poFederationChannel1ForUser2 = new FederationChannel(page2);

					await doLogin({
						page: page2,
						server: {
							url: constants.RC_SERVER_1.url,
							username: userFromServer1UsernameOnly,
							password: constants.RC_SERVER_1.password,
						},
						storeState: false,
					});

					await page2.goto(`${constants.RC_SERVER_1.url}/home`);

					await poFederationChannel1ForUser2.sidenav.openChat(createdChannel);

					await expect(page2).toHaveURL(`${constants.RC_SERVER_1.url}/channel/${createdChannel}`);

					await poFederationChannel1ForUser2.tabs.btnTabMembers.click();
					await poFederationChannel1ForUser2.tabs.members.showAllUsers();
					const usernameWithDomainFromServer2 = formatUsernameAndDomainIntoMatrixFormat(
						createdUsernameFromServer2,
						constants.RC_SERVER_2.matrixServerName,
					);

					await expect(poFederationChannel1ForUser2.tabs.members.getUserInList(usernameWithDomainFromServer2)).toBeVisible();
					await expect(poFederationChannel1ForUser2.tabs.members.getUserInList(userFromServer1UsernameOnly)).toBeVisible();
					await expect(poFederationChannel1ForUser2.tabs.members.getUserInList(constants.RC_SERVER_1.username)).toBeVisible();
					await page2.close();
				});
			});

			test.describe('With multiple users (when the user from Server B already exists in Server A)', () => {
				const createdChannel = faker.datatype.uuid();

				test('expect to create a channel inviting an user from the Server B who already exist in Server A + an user from Server A only (locally)', async ({
					browser,
					page,
				}) => {
					const pageForServer2 = await browser.newPage();
					const poFederationChannelServer2 = new FederationChannel(pageForServer2);

					await doLogin({
						page: pageForServer2,
						server: {
							url: constants.RC_SERVER_2.url,
							username: userFromServer2UsernameOnly,
							password: constants.RC_SERVER_2.password,
						},
						storeState: false,
					});

					await page.goto(`${constants.RC_SERVER_1.url}/home`);
					await pageForServer2.goto(`${constants.RC_SERVER_2.url}/home`);

					const usernameWithDomainFromServer2 = formatUsernameAndDomainIntoMatrixFormat(
						userFromServer2UsernameOnly,
						constants.RC_SERVER_2.matrixServerName,
					);
					const usernameWithDomainFromServer1 = formatUsernameAndDomainIntoMatrixFormat(
						constants.RC_SERVER_1.username,
						constants.RC_SERVER_1.matrixServerName,
					);
					const usernameOriginalFromServer1OnlyWithDomain = formatUsernameAndDomainIntoMatrixFormat(
						userFromServer1UsernameOnly,
						constants.RC_SERVER_1.matrixServerName,
					);

					await poFederationChannelServer1.createPublicChannelAndInviteUsersUsingCreationModal(createdChannel, [
						userFromServer2UsernameOnly,
						userFromServer1UsernameOnly,
					]);

					await expect(page).toHaveURL(`${constants.RC_SERVER_1.url}/channel/${createdChannel}`);

					await poFederationChannelServer1.sidenav.openChat(createdChannel);
					await poFederationChannelServer1.tabs.btnTabMembers.click();
					await poFederationChannelServer1.tabs.members.showAllUsers();

					await poFederationChannelServer2.sidenav.openChat(createdChannel);
					await poFederationChannelServer2.tabs.btnTabMembers.click();
					await poFederationChannelServer2.tabs.members.showAllUsers();

					await expect(poFederationChannelServer1.tabs.members.getUserInList(usernameWithDomainFromServer2)).toBeVisible();
					await expect(poFederationChannelServer1.tabs.members.getUserInList(userFromServer1UsernameOnly)).toBeVisible();
					await expect(poFederationChannelServer1.tabs.members.getUserInList(constants.RC_SERVER_1.username)).toBeVisible();

					await expect(poFederationChannelServer2.tabs.members.getUserInList(userFromServer2UsernameOnly)).toBeVisible();
					await expect(poFederationChannelServer2.tabs.members.getUserInList(usernameOriginalFromServer1OnlyWithDomain)).toBeVisible();
					await expect(poFederationChannelServer2.tabs.members.getUserInList(usernameWithDomainFromServer1)).toBeVisible();
					await pageForServer2.close();
				});

				test('expect the user from Server A (locally) is able to access the previous created channel', async ({ browser }) => {
					const page2 = await browser.newPage();
					const poFederationChannel1ForUser2 = new FederationChannel(page2);

					await doLogin({
						page: page2,
						server: {
							url: constants.RC_SERVER_1.url,
							username: userFromServer1UsernameOnly,
							password: constants.RC_SERVER_1.password,
						},
						storeState: false,
					});

					await page2.goto(`${constants.RC_SERVER_1.url}/home`);

					await poFederationChannel1ForUser2.sidenav.openChat(createdChannel);

					await expect(page2).toHaveURL(`${constants.RC_SERVER_1.url}/channel/${createdChannel}`);

					await poFederationChannel1ForUser2.tabs.btnTabMembers.click();
					await poFederationChannel1ForUser2.tabs.members.showAllUsers();
					const usernameWithDomainFromServer2 = formatUsernameAndDomainIntoMatrixFormat(
						userFromServer2UsernameOnly,
						constants.RC_SERVER_2.matrixServerName,
					);

					await expect(poFederationChannel1ForUser2.tabs.members.getUserInList(usernameWithDomainFromServer2)).toBeVisible();
					await expect(poFederationChannel1ForUser2.tabs.members.getUserInList(userFromServer1UsernameOnly)).toBeVisible();
					await expect(poFederationChannel1ForUser2.tabs.members.getUserInList(constants.RC_SERVER_1.username)).toBeVisible();
					await page2.close();
				});
			});

			test.describe('With local users only', () => {
				const createdChannel = faker.datatype.uuid();

				test('Create a channel inviting an user from Server A only (locally)', async ({ page }) => {
					await page.goto(`${constants.RC_SERVER_1.url}/home`);

					await poFederationChannelServer1.createPublicChannelAndInviteUsersUsingCreationModal(createdChannel, [
						userFromServer1UsernameOnly,
					]);

					await expect(page).toHaveURL(`${constants.RC_SERVER_1.url}/channel/${createdChannel}`);

					await poFederationChannelServer1.sidenav.openChat(createdChannel);
					await poFederationChannelServer1.tabs.btnTabMembers.click();
					await poFederationChannelServer1.tabs.members.showAllUsers();

					await expect(poFederationChannelServer1.tabs.members.getUserInList(userFromServer1UsernameOnly)).toBeVisible();
					await expect(poFederationChannelServer1.tabs.members.getUserInList(constants.RC_SERVER_1.username)).toBeVisible();
				});

				test('expect the user from Server A (locally) is able to access the previous created channel', async ({ browser }) => {
					const page2 = await browser.newPage();
					const poFederationChannel1ForUser2 = new FederationChannel(page2);

					await doLogin({
						page: page2,
						server: {
							url: constants.RC_SERVER_1.url,
							username: userFromServer1UsernameOnly,
							password: constants.RC_SERVER_1.password,
						},
						storeState: false,
					});

					await page2.goto(`${constants.RC_SERVER_1.url}/home`);

					await poFederationChannel1ForUser2.sidenav.openChat(createdChannel);

					await expect(page2).toHaveURL(`${constants.RC_SERVER_1.url}/channel/${createdChannel}`);

					await poFederationChannel1ForUser2.tabs.btnTabMembers.click();
					await poFederationChannel1ForUser2.tabs.members.showAllUsers();

					await expect(poFederationChannel1ForUser2.tabs.members.getUserInList(userFromServer1UsernameOnly)).toBeVisible();
					await expect(poFederationChannel1ForUser2.tabs.members.getUserInList(constants.RC_SERVER_1.username)).toBeVisible();
					await page2.close();
				});
			});
		});

		test.describe('Inviting users using the Add Members button', () => {
			test('expect to create an empty channel, and invite an user from the Server B who does not exist in Server A yet', async ({
				browser,
				page,
				apiServer2,
			}) => {
				const pageForServer2 = await browser.newPage();
				const poFederationChannelServer2 = new FederationChannel(pageForServer2);
				const channelName = faker.datatype.uuid();
				const usernameFromServer2 = await registerUser(apiServer2);

				await doLogin({
					page: pageForServer2,
					server: {
						url: constants.RC_SERVER_2.url,
						username: usernameFromServer2,
						password: constants.RC_SERVER_2.password,
					},
					storeState: false,
				});

				await page.goto(`${constants.RC_SERVER_1.url}/home`);
				await pageForServer2.goto(`${constants.RC_SERVER_2.url}/home`);

				const fullUsernameFromServer2 = formatIntoFullMatrixUsername(usernameFromServer2, constants.RC_SERVER_2.matrixServerName);
				const usernameWithDomainFromServer2 = formatUsernameAndDomainIntoMatrixFormat(
					usernameFromServer2,
					constants.RC_SERVER_2.matrixServerName,
				);
				const usernameWithDomainFromServer1 = formatUsernameAndDomainIntoMatrixFormat(
					constants.RC_SERVER_1.username,
					constants.RC_SERVER_1.matrixServerName,
				);

				await poFederationChannelServer1.createPublicChannelAndInviteUsersUsingCreationModal(channelName, []);

				await expect(page).toHaveURL(`${constants.RC_SERVER_1.url}/channel/${channelName}`);

				await poFederationChannelServer1.sidenav.openChat(channelName);
				await poFederationChannelServer1.tabs.btnTabMembers.click();
				await poFederationChannelServer1.tabs.members.showAllUsers();
				await poFederationChannelServer1.tabs.members.addMultipleUsers([fullUsernameFromServer2]);
				await expect(poFederationChannelServer1.toastSuccess).toBeVisible();

				await poFederationChannelServer2.sidenav.openChat(channelName);
				await poFederationChannelServer2.tabs.btnTabMembers.click();
				await poFederationChannelServer2.tabs.members.showAllUsers();

				await expect(poFederationChannelServer1.tabs.members.getUserInList(usernameWithDomainFromServer2)).toBeVisible();
				await expect(poFederationChannelServer1.tabs.members.getUserInList(constants.RC_SERVER_1.username)).toBeVisible();

				await expect(poFederationChannelServer2.tabs.members.getUserInList(usernameFromServer2)).toBeVisible();
				await expect(poFederationChannelServer2.tabs.members.getUserInList(usernameWithDomainFromServer1)).toBeVisible();
				await pageForServer2.close();
			});

			test('expect to create an empty channel, and invite an user from the Server B who already exist in Server A', async ({
				browser,
				page,
			}) => {
				const pageForServer2 = await browser.newPage();
				const poFederationChannelServer2 = new FederationChannel(pageForServer2);
				const channelName = faker.datatype.uuid();

				await doLogin({
					page: pageForServer2,
					server: {
						url: constants.RC_SERVER_2.url,
						username: userFromServer2UsernameOnly,
						password: constants.RC_SERVER_2.password,
					},
					storeState: false,
				});

				await page.goto(`${constants.RC_SERVER_1.url}/home`);
				await pageForServer2.goto(`${constants.RC_SERVER_2.url}/home`);

				const usernameWithDomainFromServer2 = formatUsernameAndDomainIntoMatrixFormat(
					userFromServer2UsernameOnly,
					constants.RC_SERVER_2.matrixServerName,
				);
				const usernameWithDomainFromServer1 = formatUsernameAndDomainIntoMatrixFormat(
					constants.RC_SERVER_1.username,
					constants.RC_SERVER_1.matrixServerName,
				);

				await poFederationChannelServer1.createPublicChannelAndInviteUsersUsingCreationModal(channelName, []);

				await expect(page).toHaveURL(`${constants.RC_SERVER_1.url}/channel/${channelName}`);

				await poFederationChannelServer1.sidenav.openChat(channelName);
				await poFederationChannelServer1.tabs.btnTabMembers.click();
				await poFederationChannelServer1.tabs.members.showAllUsers();
				await poFederationChannelServer1.tabs.members.addMultipleUsers([userFromServer2UsernameOnly]);
				await expect(poFederationChannelServer1.toastSuccess).toBeVisible();

				await poFederationChannelServer2.sidenav.openChat(channelName);
				await poFederationChannelServer2.tabs.btnTabMembers.click();
				await poFederationChannelServer2.tabs.members.showAllUsers();

				await expect(poFederationChannelServer1.tabs.members.getUserInList(usernameWithDomainFromServer2)).toBeVisible();
				await expect(poFederationChannelServer1.tabs.members.getUserInList(constants.RC_SERVER_1.username)).toBeVisible();

				await expect(poFederationChannelServer2.tabs.members.getUserInList(userFromServer2UsernameOnly)).toBeVisible();
				await expect(poFederationChannelServer2.tabs.members.getUserInList(usernameWithDomainFromServer1)).toBeVisible();
				await pageForServer2.close();
			});

			test.describe('With multiple users (when the remote user does not exists in the server A yet)', () => {
				const createdChannel = faker.datatype.uuid();
				let createdUsernameFromServer2: string;

				test('expect to create an empty channel, and invite an user from the Server B who does not exist in Server A yet + an user from Server A only (locally)', async ({
					browser,
					apiServer2,
					page,
				}) => {
					const pageForServer2 = await browser.newPage();
					const poFederationChannelServer2 = new FederationChannel(pageForServer2);
					createdUsernameFromServer2 = await registerUser(apiServer2);

					await doLogin({
						page: pageForServer2,
						server: {
							url: constants.RC_SERVER_2.url,
							username: createdUsernameFromServer2,
							password: constants.RC_SERVER_2.password,
						},
						storeState: false,
					});

					await page.goto(`${constants.RC_SERVER_1.url}/home`);
					await pageForServer2.goto(`${constants.RC_SERVER_2.url}/home`);

					const fullUsernameFromServer2 = formatIntoFullMatrixUsername(createdUsernameFromServer2, constants.RC_SERVER_2.matrixServerName);
					const usernameWithDomainFromServer2 = formatUsernameAndDomainIntoMatrixFormat(
						createdUsernameFromServer2,
						constants.RC_SERVER_2.matrixServerName,
					);
					const usernameWithDomainFromServer1 = formatUsernameAndDomainIntoMatrixFormat(
						constants.RC_SERVER_1.username,
						constants.RC_SERVER_1.matrixServerName,
					);
					const userCreatedWithDomainFromServer1 = formatUsernameAndDomainIntoMatrixFormat(
						userFromServer1UsernameOnly,
						constants.RC_SERVER_1.matrixServerName,
					);

					await poFederationChannelServer1.createPublicChannelAndInviteUsersUsingCreationModal(createdChannel, []);

					await expect(page).toHaveURL(`${constants.RC_SERVER_1.url}/channel/${createdChannel}`);

					await poFederationChannelServer1.sidenav.openChat(createdChannel);
					await poFederationChannelServer1.tabs.btnTabMembers.click();
					await poFederationChannelServer1.tabs.members.showAllUsers();
					await poFederationChannelServer1.tabs.members.addMultipleUsers([fullUsernameFromServer2, userFromServer1UsernameOnly]);
					await expect(poFederationChannelServer1.toastSuccess).toBeVisible();

					await poFederationChannelServer2.sidenav.openChat(createdChannel);
					await poFederationChannelServer2.tabs.btnTabMembers.click();
					await poFederationChannelServer2.tabs.members.showAllUsers();

					await expect(poFederationChannelServer1.tabs.members.getUserInList(usernameWithDomainFromServer2)).toBeVisible();
					await expect(poFederationChannelServer1.tabs.members.getUserInList(userFromServer1UsernameOnly)).toBeVisible();
					await expect(poFederationChannelServer1.tabs.members.getUserInList(constants.RC_SERVER_1.username)).toBeVisible();

					await expect(poFederationChannelServer2.tabs.members.getUserInList(createdUsernameFromServer2)).toBeVisible();
					await expect(poFederationChannelServer2.tabs.members.getUserInList(userCreatedWithDomainFromServer1)).toBeVisible();
					await expect(poFederationChannelServer2.tabs.members.getUserInList(usernameWithDomainFromServer1)).toBeVisible();
					await pageForServer2.close();
				});

				test('expect the user from Server A (locally) is able to access the previous created channel', async ({ browser }) => {
					const page2 = await browser.newPage();
					const poFederationChannel1ForUser2 = new FederationChannel(page2);

					await doLogin({
						page: page2,
						server: {
							url: constants.RC_SERVER_1.url,
							username: userFromServer1UsernameOnly,
							password: constants.RC_SERVER_1.password,
						},
						storeState: false,
					});

					await page2.goto(`${constants.RC_SERVER_1.url}/home`);

					await poFederationChannel1ForUser2.sidenav.openChat(createdChannel);

					await expect(page2).toHaveURL(`${constants.RC_SERVER_1.url}/channel/${createdChannel}`);

					await poFederationChannel1ForUser2.tabs.btnTabMembers.click();
					await poFederationChannel1ForUser2.tabs.members.showAllUsers();
					const usernameWithDomainFromServer2 = formatUsernameAndDomainIntoMatrixFormat(
						createdUsernameFromServer2,
						constants.RC_SERVER_2.matrixServerName,
					);

					await expect(poFederationChannel1ForUser2.tabs.members.getUserInList(usernameWithDomainFromServer2)).toBeVisible();
					await expect(poFederationChannel1ForUser2.tabs.members.getUserInList(userFromServer1UsernameOnly)).toBeVisible();
					await expect(poFederationChannel1ForUser2.tabs.members.getUserInList(constants.RC_SERVER_1.username)).toBeVisible();
					await page2.close();
				});
			});

			test.describe('With multiple users (when the user from Server B already exists in Server A)', () => {
				const createdChannel = faker.datatype.uuid();

				test('expect to create an empty channel, and invite an user from the Server B who already exist in Server A + an user from Server A only (locally)', async ({
					browser,
					page,
				}) => {
					const pageForServer2 = await browser.newPage();
					const poFederationChannelServer2 = new FederationChannel(pageForServer2);

					await doLogin({
						page: pageForServer2,
						server: {
							url: constants.RC_SERVER_2.url,
							username: userFromServer2UsernameOnly,
							password: constants.RC_SERVER_2.password,
						},
						storeState: false,
					});

					await page.goto(`${constants.RC_SERVER_1.url}/home`);
					await pageForServer2.goto(`${constants.RC_SERVER_2.url}/home`);

					const usernameWithDomainFromServer2 = formatUsernameAndDomainIntoMatrixFormat(
						userFromServer2UsernameOnly,
						constants.RC_SERVER_2.matrixServerName,
					);
					const usernameWithDomainFromServer1 = formatUsernameAndDomainIntoMatrixFormat(
						constants.RC_SERVER_1.username,
						constants.RC_SERVER_1.matrixServerName,
					);
					const usernameOriginalFromServer1OnlyWithDomain = formatUsernameAndDomainIntoMatrixFormat(
						userFromServer1UsernameOnly,
						constants.RC_SERVER_1.matrixServerName,
					);

					await poFederationChannelServer1.createPublicChannelAndInviteUsersUsingCreationModal(createdChannel, []);

					await expect(page).toHaveURL(`${constants.RC_SERVER_1.url}/channel/${createdChannel}`);

					await poFederationChannelServer1.sidenav.openChat(createdChannel);
					await poFederationChannelServer1.tabs.btnTabMembers.click();
					await poFederationChannelServer1.tabs.members.showAllUsers();
					await poFederationChannelServer1.tabs.members.addMultipleUsers([userFromServer1UsernameOnly, userFromServer2UsernameOnly]);
					await expect(poFederationChannelServer1.toastSuccess).toBeVisible();

					await poFederationChannelServer2.sidenav.openChat(createdChannel);
					await poFederationChannelServer2.tabs.btnTabMembers.click();
					await poFederationChannelServer2.tabs.members.showAllUsers();

					await expect(poFederationChannelServer1.tabs.members.getUserInList(usernameWithDomainFromServer2)).toBeVisible();
					await expect(poFederationChannelServer1.tabs.members.getUserInList(userFromServer1UsernameOnly)).toBeVisible();
					await expect(poFederationChannelServer1.tabs.members.getUserInList(constants.RC_SERVER_1.username)).toBeVisible();

					await expect(poFederationChannelServer2.tabs.members.getUserInList(userFromServer2UsernameOnly)).toBeVisible();
					await expect(poFederationChannelServer2.tabs.members.getUserInList(usernameOriginalFromServer1OnlyWithDomain)).toBeVisible();
					await expect(poFederationChannelServer2.tabs.members.getUserInList(usernameWithDomainFromServer1)).toBeVisible();
					await pageForServer2.close();
				});

				test('expect the user from Server A (locally) is able to access the previous created channel', async ({ browser }) => {
					const page2 = await browser.newPage();
					const poFederationChannel1ForUser2 = new FederationChannel(page2);

					await doLogin({
						page: page2,
						server: {
							url: constants.RC_SERVER_1.url,
							username: userFromServer1UsernameOnly,
							password: constants.RC_SERVER_1.password,
						},
						storeState: false,
					});

					await page2.goto(`${constants.RC_SERVER_1.url}/home`);

					await poFederationChannel1ForUser2.sidenav.openChat(createdChannel);

					await expect(page2).toHaveURL(`${constants.RC_SERVER_1.url}/channel/${createdChannel}`);

					await poFederationChannel1ForUser2.tabs.btnTabMembers.click();
					await poFederationChannel1ForUser2.tabs.members.showAllUsers();
					const usernameWithDomainFromServer2 = formatUsernameAndDomainIntoMatrixFormat(
						userFromServer2UsernameOnly,
						constants.RC_SERVER_2.matrixServerName,
					);

					await expect(poFederationChannel1ForUser2.tabs.members.getUserInList(usernameWithDomainFromServer2)).toBeVisible();
					await expect(poFederationChannel1ForUser2.tabs.members.getUserInList(userFromServer1UsernameOnly)).toBeVisible();
					await expect(poFederationChannel1ForUser2.tabs.members.getUserInList(constants.RC_SERVER_1.username)).toBeVisible();
					await page2.close();
				});
			});

			test.describe('With local users only', () => {
				const createdChannel = faker.datatype.uuid();

				test('Create an empty channel, and invite an an user from Server A only (locally)', async ({ page }) => {
					await page.goto(`${constants.RC_SERVER_1.url}/home`);

					await poFederationChannelServer1.createPublicChannelAndInviteUsersUsingCreationModal(createdChannel, []);

					await expect(page).toHaveURL(`${constants.RC_SERVER_1.url}/channel/${createdChannel}`);

					await poFederationChannelServer1.sidenav.openChat(createdChannel);
					await poFederationChannelServer1.tabs.btnTabMembers.click();
					await poFederationChannelServer1.tabs.members.showAllUsers();
					await poFederationChannelServer1.tabs.members.addMultipleUsers([userFromServer1UsernameOnly]);

					await expect(poFederationChannelServer1.toastSuccess).toBeVisible();

					await expect(poFederationChannelServer1.tabs.members.getUserInList(userFromServer1UsernameOnly)).toBeVisible();
					await expect(poFederationChannelServer1.tabs.members.getUserInList(constants.RC_SERVER_1.username)).toBeVisible();
				});

				test('expect the user from Server A (locally) is able to access the previous created channel', async ({ browser }) => {
					const page2 = await browser.newPage();
					const poFederationChannel1ForUser2 = new FederationChannel(page2);

					await doLogin({
						page: page2,
						server: {
							url: constants.RC_SERVER_1.url,
							username: userFromServer1UsernameOnly,
							password: constants.RC_SERVER_1.password,
						},
						storeState: false,
					});

					await page2.goto(`${constants.RC_SERVER_1.url}/home`);

					await poFederationChannel1ForUser2.sidenav.openChat(createdChannel);

					await expect(page2).toHaveURL(`${constants.RC_SERVER_1.url}/channel/${createdChannel}`);

					await poFederationChannel1ForUser2.tabs.btnTabMembers.click();
					await poFederationChannel1ForUser2.tabs.members.showAllUsers();

					await expect(poFederationChannel1ForUser2.tabs.members.getUserInList(userFromServer1UsernameOnly)).toBeVisible();
					await expect(poFederationChannel1ForUser2.tabs.members.getUserInList(constants.RC_SERVER_1.username)).toBeVisible();
					await page2.close();
				});
			});
		});

		test.describe('Visual Elements', () => {
			test('expect the calls button to be disabled', async ({ browser, page }) => {
				const pageForServer2 = await browser.newPage();
				const poFederationChannelServer2 = new FederationChannel(pageForServer2);

				await doLogin({
					page: pageForServer2,
					server: {
						url: constants.RC_SERVER_2.url,
						username: userFromServer2UsernameOnly,
						password: constants.RC_SERVER_2.password,
					},
					storeState: false,
				});

				await page.goto(`${constants.RC_SERVER_1.url}/home`);
				await pageForServer2.goto(`${constants.RC_SERVER_2.url}/home`);

				await poFederationChannelServer1.sidenav.openChat(createdChannelName);
				await poFederationChannelServer2.sidenav.openChat(createdChannelName);

				await expect(page).toHaveURL(`${constants.RC_SERVER_1.url}/channel/${createdChannelName}`);
				await expect(pageForServer2).toHaveURL(`${constants.RC_SERVER_2.url}/channel/${createdChannelName}`);

				await expect(poFederationChannelServer1.tabs.btnCall).toBeDisabled();
				await expect(poFederationChannelServer2.tabs.btnCall).toBeDisabled();

				await pageForServer2.close();
			});

			test('expect the threads button to be disabled', async ({ browser, page }) => {
				const pageForServer2 = await browser.newPage();
				const poFederationChannelServer2 = new FederationChannel(pageForServer2);

				await doLogin({
					page: pageForServer2,
					server: {
						url: constants.RC_SERVER_2.url,
						username: userFromServer2UsernameOnly,
						password: constants.RC_SERVER_2.password,
					},
					storeState: false,
				});

				await page.goto(`${constants.RC_SERVER_1.url}/home`);
				await pageForServer2.goto(`${constants.RC_SERVER_2.url}/home`);

				await poFederationChannelServer1.sidenav.openChat(createdChannelName);
				await poFederationChannelServer2.sidenav.openChat(createdChannelName);

				await expect(page).toHaveURL(`${constants.RC_SERVER_1.url}/channel/${createdChannelName}`);
				await expect(pageForServer2).toHaveURL(`${constants.RC_SERVER_2.url}/channel/${createdChannelName}`);

				await expect(poFederationChannelServer1.tabs.btnThread).toBeDisabled();
				await expect(poFederationChannelServer2.tabs.btnThread).toBeDisabled();

				await pageForServer2.close();
			});

			test('expect the discussion button to be disabled', async ({ browser, page }) => {
				const pageForServer2 = await browser.newPage();
				const poFederationChannelServer2 = new FederationChannel(pageForServer2);

				await doLogin({
					page: pageForServer2,
					server: {
						url: constants.RC_SERVER_2.url,
						username: userFromServer2UsernameOnly,
						password: constants.RC_SERVER_2.password,
					},
					storeState: false,
				});

				await page.goto(`${constants.RC_SERVER_1.url}/home`);
				await pageForServer2.goto(`${constants.RC_SERVER_2.url}/home`);

				await poFederationChannelServer1.sidenav.openChat(createdChannelName);
				await poFederationChannelServer2.sidenav.openChat(createdChannelName);

				await expect(page).toHaveURL(`${constants.RC_SERVER_1.url}/channel/${createdChannelName}`);
				await expect(pageForServer2).toHaveURL(`${constants.RC_SERVER_2.url}/channel/${createdChannelName}`);

				await expect(poFederationChannelServer1.tabs.btnDiscussion).toBeDisabled();
				await expect(poFederationChannelServer2.tabs.btnDiscussion).toBeDisabled();

				await pageForServer2.close();
			});
		});

		test.describe('Owner rights', () => {
			test('expect only the room owner being able to delete the channel', async ({ browser, page }) => {
				const pageForServer2 = await browser.newPage();
				const poFederationChannelServer2 = new FederationChannel(pageForServer2);

				await doLogin({
					page: pageForServer2,
					server: {
						url: constants.RC_SERVER_2.url,
						username: userFromServer2UsernameOnly,
						password: constants.RC_SERVER_2.password,
					},
					storeState: false,
				});

				await page.goto(`${constants.RC_SERVER_1.url}/home`);
				await pageForServer2.goto(`${constants.RC_SERVER_2.url}/home`);

				await poFederationChannelServer1.sidenav.openChat(createdChannelName);
				await poFederationChannelServer2.sidenav.openChat(createdChannelName);

				await expect(page).toHaveURL(`${constants.RC_SERVER_1.url}/channel/${createdChannelName}`);
				await expect(pageForServer2).toHaveURL(`${constants.RC_SERVER_2.url}/channel/${createdChannelName}`);

				await expect(poFederationChannelServer1.tabs.btnRoomInfo).toBeVisible();
				await poFederationChannelServer1.tabs.btnRoomInfo.click();
				await expect(poFederationChannelServer1.tabs.room.btnDelete).toBeVisible();

				await expect(poFederationChannelServer2.tabs.btnRoomInfo).toBeVisible();
				await poFederationChannelServer2.tabs.btnRoomInfo.click();
				await expect(poFederationChannelServer2.tabs.room.btnDelete).not.toBeVisible();

				await pageForServer2.close();
			});

			test('expect only the room owner being able to add users through the UI', async ({ browser, page }) => {
				const pageForServer2 = await browser.newPage();
				const poFederationChannelServer2 = new FederationChannel(pageForServer2);

				await doLogin({
					page: pageForServer2,
					server: {
						url: constants.RC_SERVER_2.url,
						username: userFromServer2UsernameOnly,
						password: constants.RC_SERVER_2.password,
					},
					storeState: false,
				});

				await page.goto(`${constants.RC_SERVER_1.url}/home`);
				await pageForServer2.goto(`${constants.RC_SERVER_2.url}/home`);

				await poFederationChannelServer1.sidenav.openChat(createdChannelName);
				await poFederationChannelServer2.sidenav.openChat(createdChannelName);

				await expect(page).toHaveURL(`${constants.RC_SERVER_1.url}/channel/${createdChannelName}`);
				await expect(pageForServer2).toHaveURL(`${constants.RC_SERVER_2.url}/channel/${createdChannelName}`);

				await expect(poFederationChannelServer1.tabs.btnTabMembers).toBeVisible();
				await poFederationChannelServer1.tabs.btnTabMembers.click();
				await expect(poFederationChannelServer1.tabs.members.addUsersButton).toBeVisible();

				await expect(poFederationChannelServer2.tabs.btnTabMembers).toBeVisible();
				await poFederationChannelServer2.tabs.btnTabMembers.click();
				await expect(poFederationChannelServer2.tabs.members.addUsersButton).not.toBeVisible();

				await pageForServer2.close();
			});

			test('expect only the room owner being able remove users from the room (kebab menu)', async ({ browser, page }) => {
				const pageForServer2 = await browser.newPage();
				const poFederationChannelServer2 = new FederationChannel(pageForServer2);
				const usernameWithDomainFromServer2 = formatUsernameAndDomainIntoMatrixFormat(
					userFromServer2UsernameOnly,
					constants.RC_SERVER_2.matrixServerName,
				);
				const usernameWithDomainFromServer1 = formatUsernameAndDomainIntoMatrixFormat(
					constants.RC_SERVER_1.username,
					constants.RC_SERVER_1.matrixServerName,
				);

				await doLogin({
					page: pageForServer2,
					server: {
						url: constants.RC_SERVER_2.url,
						username: userFromServer2UsernameOnly,
						password: constants.RC_SERVER_2.password,
					},
					storeState: false,
				});

				await page.goto(`${constants.RC_SERVER_1.url}/home`);
				await pageForServer2.goto(`${constants.RC_SERVER_2.url}/home`);

				await poFederationChannelServer1.sidenav.openChat(createdChannelName);
				await poFederationChannelServer2.sidenav.openChat(createdChannelName);

				await expect(page).toHaveURL(`${constants.RC_SERVER_1.url}/channel/${createdChannelName}`);
				await expect(pageForServer2).toHaveURL(`${constants.RC_SERVER_2.url}/channel/${createdChannelName}`);

				await expect(poFederationChannelServer1.tabs.btnTabMembers).toBeVisible();
				await poFederationChannelServer1.tabs.btnTabMembers.click();
				await (await poFederationChannelServer1.tabs.members.getUserInList(usernameWithDomainFromServer2)).hover();
				await (await poFederationChannelServer1.tabs.members.getKebabMenuForUser(usernameWithDomainFromServer2)).click();
				await expect(await poFederationChannelServer1.tabs.members.getOptionFromKebabMenuForUser('removeUser')).toBeVisible();

				await expect(poFederationChannelServer2.tabs.btnTabMembers).toBeVisible();
				await poFederationChannelServer2.tabs.btnTabMembers.click();
				await (await poFederationChannelServer2.tabs.members.getUserInList(usernameWithDomainFromServer1)).hover();
				await (await poFederationChannelServer2.tabs.members.getKebabMenuForUser(usernameWithDomainFromServer1)).click();
				await expect(await poFederationChannelServer2.tabs.members.getOptionFromKebabMenuForUser('removeUser')).not.toBeVisible();

				await pageForServer2.close();
			});

			test('expect only the room owner being able remove users from the room (user info page)', async ({ browser, page }) => {
				const pageForServer2 = await browser.newPage();
				const poFederationChannelServer2 = new FederationChannel(pageForServer2);
				const usernameWithDomainFromServer2 = formatUsernameAndDomainIntoMatrixFormat(
					userFromServer2UsernameOnly,
					constants.RC_SERVER_2.matrixServerName,
				);
				const usernameWithDomainFromServer1 = formatUsernameAndDomainIntoMatrixFormat(
					constants.RC_SERVER_1.username,
					constants.RC_SERVER_1.matrixServerName,
				);

				await doLogin({
					page: pageForServer2,
					server: {
						url: constants.RC_SERVER_2.url,
						username: userFromServer2UsernameOnly,
						password: constants.RC_SERVER_2.password,
					},
					storeState: false,
				});

				await page.goto(`${constants.RC_SERVER_1.url}/home`);
				await pageForServer2.goto(`${constants.RC_SERVER_2.url}/home`);

				await poFederationChannelServer1.sidenav.openChat(createdChannelName);
				await poFederationChannelServer2.sidenav.openChat(createdChannelName);

				await expect(page).toHaveURL(`${constants.RC_SERVER_1.url}/channel/${createdChannelName}`);
				await expect(pageForServer2).toHaveURL(`${constants.RC_SERVER_2.url}/channel/${createdChannelName}`);

				await expect(poFederationChannelServer1.tabs.btnTabMembers).toBeVisible();
				await poFederationChannelServer1.tabs.btnTabMembers.click();
				await (await poFederationChannelServer1.tabs.members.getUserInList(usernameWithDomainFromServer2)).click();
				await expect(poFederationChannelServer1.tabs.members.btnRemoveUserFromRoom).toBeVisible();

				await expect(poFederationChannelServer2.tabs.btnTabMembers).toBeVisible();
				await poFederationChannelServer2.tabs.btnTabMembers.click();
				await (await poFederationChannelServer2.tabs.members.getUserInList(usernameWithDomainFromServer1)).click();
				await expect(poFederationChannelServer2.tabs.members.btnRemoveUserFromRoom).not.toBeVisible();

				await pageForServer2.close();
			});

			// TODO: skipping this test until we have the Synapse server to test against, this is having some intermittencies
			test.skip('expect only the room owner being able to edit the channel name AND the channel topic', async ({ browser, page }) => {
				const pageForServer2 = await browser.newPage();
				const poFederationChannelServer2 = new FederationChannel(pageForServer2);

				await doLogin({
					page: pageForServer2,
					server: {
						url: constants.RC_SERVER_2.url,
						username: userFromServer2UsernameOnly,
						password: constants.RC_SERVER_2.password,
					},
					storeState: false,
				});

				await page.goto(`${constants.RC_SERVER_1.url}/home`);
				await pageForServer2.goto(`${constants.RC_SERVER_2.url}/home`);

				await poFederationChannelServer1.sidenav.openChat(createdChannelName);
				await poFederationChannelServer2.sidenav.openChat(createdChannelName);

				await expect(page).toHaveURL(`${constants.RC_SERVER_1.url}/channel/${createdChannelName}`);
				await expect(pageForServer2).toHaveURL(`${constants.RC_SERVER_2.url}/channel/${createdChannelName}`);

				await expect(poFederationChannelServer1.tabs.btnRoomInfo).toBeVisible();
				await poFederationChannelServer1.tabs.btnRoomInfo.click();
				await expect(poFederationChannelServer1.tabs.room.btnEdit).toBeVisible();

				await expect(poFederationChannelServer2.tabs.btnRoomInfo).toBeVisible();
				await poFederationChannelServer2.tabs.btnRoomInfo.click();
				await expect(poFederationChannelServer2.tabs.room.btnEdit).not.toBeVisible();

				await poFederationChannelServer1.tabs.room.btnEdit.click();
				await poFederationChannelServer1.tabs.room.inputName.fill(`NAME-EDITED-${createdChannelName}`);
				await poFederationChannelServer1.tabs.room.btnSave.click();
				await page.waitForTimeout(5000);

				await poFederationChannelServer2.sidenav.openChat(`NAME-EDITED-${createdChannelName}`);

				await expect(page).toHaveURL(`${constants.RC_SERVER_1.url}/channel/NAME-EDITED-${createdChannelName}`);
				await expect(pageForServer2).toHaveURL(`${constants.RC_SERVER_2.url}/channel/NAME-EDITED-${createdChannelName}`);

				const nameChangedSystemMessageServer1 = await poFederationChannelServer1.content.getSystemMessageByText(
					`changed room name to NAME-EDITED-${createdChannelName}`,
				);
				await expect(nameChangedSystemMessageServer1).toBeVisible();
				const nameChangedSystemMessageServer2 = await poFederationChannelServer2.content.getSystemMessageByText(
					`changed room name to NAME-EDITED-${createdChannelName}`,
				);
				await expect(nameChangedSystemMessageServer2).toBeVisible();

				await poFederationChannelServer1.tabs.room.btnEdit.click();
				await poFederationChannelServer1.tabs.room.inputTopic.fill('hello-topic-edited');
				await poFederationChannelServer1.tabs.room.btnSave.click();

				const topicChangedSystemMessageServer1 = await poFederationChannelServer1.content.getSystemMessageByText(
					'changed room topic to hello-topic-edited',
				);
				await expect(topicChangedSystemMessageServer1).toBeVisible();
				const topicChangedSystemMessageServer2 = await poFederationChannelServer2.content.getSystemMessageByText(
					'changed room topic to hello-topic-edited',
				);
				await expect(topicChangedSystemMessageServer2).toBeVisible();

				await pageForServer2.close();
			});
		});

		test.describe('Removing users from room', () => {
			test('expect to remove the invitee from the room', async ({ browser, page, apiServer2 }) => {
				const pageForServer2 = await browser.newPage();
				const poFederationChannelServer2 = new FederationChannel(pageForServer2);
				const channelName = faker.datatype.uuid();
				const usernameFromServer2 = await registerUser(apiServer2);

				await doLogin({
					page: pageForServer2,
					server: {
						url: constants.RC_SERVER_2.url,
						username: usernameFromServer2,
						password: constants.RC_SERVER_2.password,
					},
					storeState: false,
				});

				await page.goto(`${constants.RC_SERVER_1.url}/home`);
				await pageForServer2.goto(`${constants.RC_SERVER_2.url}/home`);

				const fullUsernameFromServer2 = formatIntoFullMatrixUsername(usernameFromServer2, constants.RC_SERVER_2.matrixServerName);
				const usernameWithDomainFromServer2 = formatUsernameAndDomainIntoMatrixFormat(
					usernameFromServer2,
					constants.RC_SERVER_2.matrixServerName,
				);
				const usernameWithDomainFromServer1 = formatUsernameAndDomainIntoMatrixFormat(
					constants.RC_SERVER_1.username,
					constants.RC_SERVER_1.matrixServerName,
				);

				await poFederationChannelServer1.createPublicChannelAndInviteUsersUsingCreationModal(channelName, [fullUsernameFromServer2]);

				await expect(page).toHaveURL(`${constants.RC_SERVER_1.url}/channel/${channelName}`);

				await poFederationChannelServer1.sidenav.openChat(channelName);
				await poFederationChannelServer1.tabs.btnTabMembers.click();
				await poFederationChannelServer1.tabs.members.showAllUsers();

				await poFederationChannelServer2.sidenav.openChat(channelName);
				await poFederationChannelServer2.tabs.btnTabMembers.click();
				await poFederationChannelServer2.tabs.members.showAllUsers();

				await expect(poFederationChannelServer1.tabs.members.getUserInList(usernameWithDomainFromServer2)).toBeVisible();
				await expect(poFederationChannelServer1.tabs.members.getUserInList(constants.RC_SERVER_1.username)).toBeVisible();

				await expect(poFederationChannelServer2.tabs.members.getUserInList(usernameFromServer2)).toBeVisible();
				await expect(poFederationChannelServer2.tabs.members.getUserInList(usernameWithDomainFromServer1)).toBeVisible();
				await poFederationChannelServer2.tabs.btnTabMembers.click();

				await poFederationChannelServer1.tabs.members.removeUserFromRoom(usernameWithDomainFromServer2);
				const removedSystemMessageServer1 = await poFederationChannelServer1.content.getSystemMessageByText(
					`removed ${usernameWithDomainFromServer2}`,
				);
				await expect(removedSystemMessageServer1).toBeVisible();
				await expect(poFederationChannelServer1.tabs.members.getUserInList(usernameWithDomainFromServer2)).not.toBeVisible();
				await expect(poFederationChannelServer1.tabs.members.getUserInList(constants.RC_SERVER_1.username)).toBeVisible();
				await expect(await (await poFederationChannelServer1.content.getLastSystemMessageName()).textContent()).toBe(
					constants.RC_SERVER_1.username,
				);

				const removedSystemMessageServer2 = await poFederationChannelServer2.content.getSystemMessageByText(
					`removed ${usernameFromServer2}`,
				);
				await expect(removedSystemMessageServer2).toBeVisible();
				await poFederationChannelServer2.tabs.btnTabMembers.click();
				await expect(poFederationChannelServer2.tabs.members.getUserInList(usernameFromServer2)).not.toBeVisible();
				await expect(poFederationChannelServer2.tabs.members.getUserInList(usernameWithDomainFromServer1)).toBeVisible();
				await expect(await (await poFederationChannelServer2.content.getLastSystemMessageName()).textContent()).toBe(
					usernameWithDomainFromServer1,
				);

				// TODO: double check if the user is removed from the room in the external server + check the system message there

				await pageForServer2.close();
			});
		});

		test.describe('Leaving the room', () => {
			test('expect the invitee to be able to leave the room', async ({ browser, page, apiServer2 }) => {
				const pageForServer2 = await browser.newPage();
				const poFederationChannelServer2 = new FederationChannel(pageForServer2);
				const channelName = faker.datatype.uuid();
				const usernameFromServer2 = await registerUser(apiServer2);

				await doLogin({
					page: pageForServer2,
					server: {
						url: constants.RC_SERVER_2.url,
						username: usernameFromServer2,
						password: constants.RC_SERVER_2.password,
					},
					storeState: false,
				});

				await page.goto(`${constants.RC_SERVER_1.url}/home`);
				await pageForServer2.goto(`${constants.RC_SERVER_2.url}/home`);

				const fullUsernameFromServer2 = formatIntoFullMatrixUsername(usernameFromServer2, constants.RC_SERVER_2.matrixServerName);
				const usernameWithDomainFromServer2 = formatUsernameAndDomainIntoMatrixFormat(
					usernameFromServer2,
					constants.RC_SERVER_2.matrixServerName,
				);

				await poFederationChannelServer1.createPublicChannelAndInviteUsersUsingCreationModal(channelName, [fullUsernameFromServer2]);

				await expect(page).toHaveURL(`${constants.RC_SERVER_1.url}/channel/${channelName}`);

				await poFederationChannelServer2.sidenav.openChat(channelName);
				await poFederationChannelServer2.tabs.btnRoomInfo.click();
				await expect(poFederationChannelServer2.tabs.room.btnLeave).toBeVisible();

				await poFederationChannelServer2.tabs.room.btnLeave.click();
				await poFederationChannelServer2.tabs.room.btnModalConfirm.click();

				const leftChannelSystemMessageServer1 = await poFederationChannelServer1.content.getSystemMessageByText('left the channel');
				await expect(leftChannelSystemMessageServer1).toBeVisible();
				await expect(await (await poFederationChannelServer1.content.getLastSystemMessageName()).textContent()).toBe(
					usernameWithDomainFromServer2,
				);

				await poFederationChannelServer2.sidenav.openChat(channelName);
				const leftChannelSystemMessageServer2 = await poFederationChannelServer1.content.getSystemMessageByText('left the channel');
				await expect(leftChannelSystemMessageServer2).toBeVisible();
				await expect(await (await poFederationChannelServer2.content.getLastSystemMessageName()).textContent()).toBe(usernameFromServer2);
				await poFederationChannelServer2.tabs.btnTabMembers.click();
				await poFederationChannelServer2.tabs.members.showAllUsers();
				await expect(poFederationChannelServer2.tabs.members.getUserInList(usernameFromServer2)).not.toBeVisible();

				await pageForServer2.close();
			});
		});
	});
});