<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Api\EventsTable;

/**
 * Turns the two stored event settings into the rows of the admin's event table
 *
 * One row per known event, grouped as the events were registered (a group appears where its first event was
 * registered). A row is sent unless the disabled-events list names it, and goes through the channel of its last
 * routing row whose channel exists, else the browser; an event whose channel is fixed shows that channel whatever the
 * rows say. Each row says whether the shopper's browser detects the event, as its registration does, so the source a
 * row shows can be told apart from what the server detects. Entries for events no module registers are kept apart,
 * unchanged, so saving the table does not lose the choices made for an event whose module is switched off for a
 * while. The stored values themselves, read as names and rows, come back too: they are what the form posts until the
 * table changes.
 *
 * @phpstan-type Row array{
 *     event: string,
 *     label: string,
 *     trigger: string,
 *     hint: string,
 *     source: string,
 *     browser: bool,
 *     send: bool,
 *     channel: string,
 *     fixed: bool
 * }
 * @phpstan-type Table array{
 *     groups: list<array{label: string, rows: list<Row>}>,
 *     kept: array{disabled: list<string>, routing: list<array{event: string, channel: string}>},
 *     stored: array{disabled: list<string>, routing: list<array{event: string, channel: string}>}
 * }
 * @api
 */
interface EventsTableBuilderInterface
{
    /**
     * Build the table from the stored values
     *
     * @param mixed $disabled The disabled-events setting as stored: a comma list, or a list of names
     * @param mixed $routing The routing setting as loaded (rows of an `event` and a `channel`) or as stored
     * @return Table
     */
    public function build(mixed $disabled, mixed $routing): array;
}
