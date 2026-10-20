/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

/**
 * Registers the data layer's validation rules with the settings form's validator, with their wording.
 *
 * A mixin of the validator module, so the rules exist whenever a form can be validated. The checks themselves live in
 * the pure rules module; this file only names them and gives each its message.
 */
define([
    'jquery',
    'mage/translate',
    'Hryvinskyi_DataLayerAdminUi/js/validation/rules'
], function ($, $t, rules) {
    'use strict';

    return function (validation) {
        $.validator.addMethod(
            'validate-hryvinskyi-gtm-container-id',
            rules.isContainerId,
            $t('Use the format GTM- followed by letters and digits, for example GTM-XXXXXXX. No spaces.')
        );
        $.validator.addMethod(
            'validate-hryvinskyi-host-name',
            rules.isHostName,
            $t('Enter the host name only, for example gtm.example.com. Remove “https://” and the path.')
        );
        $.validator.addMethod(
            'validate-hryvinskyi-measurement-id',
            rules.isMeasurementId,
            $t('Use the format G- followed by letters and digits.')
        );
        $.validator.addMethod(
            'validate-hryvinskyi-ads-conversion-id',
            rules.isAdsConversionId,
            $t('Use the format AW- followed by digits, for example AW-123456789.')
        );
        $.validator.addMethod(
            'validate-hryvinskyi-ads-conversion-label',
            rules.isAdsConversionLabel,
            $t('Use letters, digits, underscores and hyphens only: the part after the slash in send_to.')
        );

        return validation;
    };
});
