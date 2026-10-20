<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Api\Setup\Data;

/**
 * One setting the setup wizard edits: its wizard key, the config path it is stored under, how its value is read and
 * written, and the step that shows it
 *
 * The label, the options and the scopes a setting reaches are not described here: they come from the configuration
 * page's own field for the same path, which stays the one place they are declared.
 *
 * @api
 */
interface SettingDescriptorInterface
{
    /**
     * Get the key the wizard knows the setting by
     *
     * @return string Lower-case letters, digits and underscores
     */
    public function getKey(): string;

    /**
     * Get the config path the setting is stored under
     *
     * @return string At least three segments, as `section/group/field`
     */
    public function getPath(): string;

    /**
     * Get the code of the kind that reads and writes the value
     *
     * @return string A code the setting kinds know, such as `flag`, `choice`, `text`, `number` or `secret`
     */
    public function getKind(): string;

    /**
     * Get the id of the wizard step that shows the setting
     *
     * @return string Lower-case letters, digits, underscores and hyphens
     */
    public function getStep(): string;

    /**
     * Get the pattern a filled-in value must match
     *
     * @return string|null A PCRE pattern with its delimiters, or null when any value is accepted
     */
    public function getPattern(): ?string;

    /**
     * Whether the value is accepted in any letter case and stored in capitals
     *
     * @return bool
     */
    public function isCaseInsensitive(): bool;

    /**
     * Get the smallest number accepted
     *
     * @return int|null Null when there is no lower bound
     */
    public function getMin(): ?int;

    /**
     * Get the largest number accepted
     *
     * @return int|null Null when there is no upper bound
     */
    public function getMax(): ?int;
}
