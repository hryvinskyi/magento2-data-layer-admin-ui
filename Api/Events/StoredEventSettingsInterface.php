<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Api\Events;

/**
 * Reads the two stored event settings, the disabled-events list and the routing rows, the way every admin screen
 * reads them
 *
 * Nothing is filtered by whether a module registers the event: a caller decides what to do with names it does not
 * know.
 *
 * @api
 */
interface StoredEventSettingsInterface
{
    /**
     * Read the names of a disabled-events value
     *
     * @param mixed $value A comma list, or a list of names
     * @return list<string> Trimmed, without empty names or repeats, in stored order
     */
    public function disabledNames(mixed $value): array;

    /**
     * Read the rows of a routing value
     *
     * @param mixed $value The value as stored (serialized text) or as loaded (rows); anything unreadable is no rows
     * @return list<array{event: string, channel: string}> Only rows whose event and channel are both text, in stored
     *     order
     */
    public function routingRows(mixed $value): array;
}
