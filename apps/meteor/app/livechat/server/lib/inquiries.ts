import type { ILivechatInquiryRecord } from '@rocket.chat/core-typings';
import { OmnichannelSortingMechanismSettingType } from '@rocket.chat/core-typings';
import type { SortDirection } from 'mongodb';

export const getInquirySortQuery = (
	sortByMechanism: OmnichannelSortingMechanismSettingType = OmnichannelSortingMechanismSettingType.Timestamp,
): Partial<{ [k in keyof ILivechatInquiryRecord]: SortDirection }> => {
	switch (sortByMechanism) {
		case OmnichannelSortingMechanismSettingType.Priority:
			return { priorityWeight: -1, ts: 1 };
		case OmnichannelSortingMechanismSettingType.SLAs:
			return { estimatedServiceTimeAt: 1, ts: 1 };
		case OmnichannelSortingMechanismSettingType.Timestamp:
		default:
			return { ts: -1 };
	}
};