<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Api\Setup;

/**
 * Saves the changes the setup wizard collected, each one setting at one scope
 *
 * A change sets a setting's value at a scope (`op` `set`, with its `value`) or removes the scope's own value so it
 * inherits (`op` `inherit`). The request is checked whole before anything is written: an unknown scope or setting, a
 * setting the signed-in user may not change, a scope the setting cannot be set at, an inherit at the default scope, a
 * value the setting does not take or a setting changed twice at one scope refuses the whole request. A valid request
 * is saved scope by scope; a change can still fail on its own, when the deployment configuration fixes the setting at
 * its scope or the setting's save rules refuse its value, and the other changes are saved regardless. Saving the same
 * request again changes nothing more.
 *
 * @phpstan-type Result array{scope: string, key: string, status: 'saved'|'failed', message?: string}
 * @api
 */
interface SetupSaverInterface
{
    /**
     * Save changes
     *
     * @param array<mixed> $changes Each `array{scope: string, key: string, op: 'set'|'inherit', value?: mixed}`
     * @return list<Result> One result per change, in the order of the changes; a failed change carries a message for
     *     the person saving
     * @throws InvalidSetupRequestException When the request is invalid; nothing is written and the reason says why
     */
    public function save(array $changes): array;
}
