/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

/**
 * The shapes the data layer's settings accept, mirroring what the server checks when they are saved. Pure: no DOM,
 * no jQuery, no wording.
 *
 * Every check accepts an empty value: whether a setting is required is decided elsewhere. Values are trimmed first,
 * as the server trims them; ids the server stores in capitals are compared in capitals.
 *
 * An AMD module because the settings form's validator is reached only through RequireJS.
 */
define([], function () {
    'use strict';

    var CONTAINER_ID = /^GTM-[A-Z0-9]+$/,
        HOST_NAME = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i,
        MEASUREMENT_ID = /^G-[A-Z0-9]+$/,
        ADS_CONVERSION_ID = /^AW-\d+$/,
        ADS_CONVERSION_LABEL = /^[A-Za-z0-9_-]+$/;

    /**
     * @param {*} value
     * @returns {string} The value as trimmed text
     */
    function text(value) {
        return typeof value === 'string' ? value.trim() : '';
    }

    /**
     * @param {RegExp} pattern
     * @param {boolean} upperCase Whether the value is compared in capitals
     * @returns {function(*): boolean}
     */
    function emptyOr(pattern, upperCase) {
        return function (value) {
            var trimmed = text(value);

            return trimmed === '' || pattern.test(upperCase ? trimmed.toUpperCase() : trimmed);
        };
    }

    return Object.freeze({
        isContainerId: emptyOr(CONTAINER_ID, false),
        isHostName: emptyOr(HOST_NAME, false),
        isMeasurementId: emptyOr(MEASUREMENT_ID, true),
        isAdsConversionId: emptyOr(ADS_CONVERSION_ID, true),
        isAdsConversionLabel: emptyOr(ADS_CONVERSION_LABEL, false)
    });
});
