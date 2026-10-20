<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Model\Setup\Data;

use Hryvinskyi\DataLayerAdminUi\Api\Setup\Data\SettingDescriptorInterface;
use Hryvinskyi\DataLayerAdminUi\Api\Setup\SetupStateProviderInterface;

/**
 * A wizard setting's description, valid by construction
 *
 * The key is lower-case letters, digits and underscores and never the events setting's key; the path has at least
 * three segments of letters, digits and underscores; the step id is lower-case letters, digits, underscores and
 * hyphens; a lower bound is never above an upper bound. Anything else is refused when the description is created.
 */
class SettingDescriptor implements SettingDescriptorInterface
{
    private const KEY_PATTERN = '/^[a-z0-9_]+$/D';
    private const PATH_PATTERN = '#^[A-Za-z0-9_]+(?:/[A-Za-z0-9_]+){2,}$#D';
    private const STEP_PATTERN = '/^[a-z0-9_-]+$/D';

    /**
     * @param string $key
     * @param string $path
     * @param string $kind
     * @param string $step
     * @param string|null $pattern
     * @param bool $caseInsensitive
     * @param int|null $min
     * @param int|null $max
     * @throws \InvalidArgumentException When the key, the path, the kind, the step or the bounds are unusable
     */
    public function __construct(
        private readonly string $key,
        private readonly string $path,
        private readonly string $kind,
        private readonly string $step,
        private readonly ?string $pattern = null,
        private readonly bool $caseInsensitive = false,
        private readonly ?int $min = null,
        private readonly ?int $max = null
    ) {
        if (preg_match(self::KEY_PATTERN, $key) !== 1 || $key === SetupStateProviderInterface::EVENTS_KEY) {
            throw new \InvalidArgumentException(sprintf(
                '"%s" is not a wizard setting key: use lower-case letters, digits and underscores, and not "%s".',
                $key,
                SetupStateProviderInterface::EVENTS_KEY
            ));
        }
        if (preg_match(self::PATH_PATTERN, $path) !== 1) {
            throw new \InvalidArgumentException(sprintf(
                'The wizard setting "%s" needs a config path of at least three segments, not "%s".',
                $key,
                $path
            ));
        }
        if ($kind === '') {
            throw new \InvalidArgumentException(sprintf('The wizard setting "%s" needs a kind.', $key));
        }
        if (preg_match(self::STEP_PATTERN, $step) !== 1) {
            throw new \InvalidArgumentException(sprintf(
                'The wizard setting "%s" needs a step id of lower-case letters, digits, underscores and hyphens.',
                $key
            ));
        }
        if ($pattern === '') {
            throw new \InvalidArgumentException(sprintf('The wizard setting "%s" names an empty pattern.', $key));
        }
        if ($min !== null && $max !== null && $min > $max) {
            throw new \InvalidArgumentException(
                sprintf('The wizard setting "%s" has a lower bound above its upper bound.', $key)
            );
        }
    }

    /**
     * @inheritDoc
     */
    public function getKey(): string
    {
        return $this->key;
    }

    /**
     * @inheritDoc
     */
    public function getPath(): string
    {
        return $this->path;
    }

    /**
     * @inheritDoc
     */
    public function getKind(): string
    {
        return $this->kind;
    }

    /**
     * @inheritDoc
     */
    public function getStep(): string
    {
        return $this->step;
    }

    /**
     * @inheritDoc
     */
    public function getPattern(): ?string
    {
        return $this->pattern;
    }

    /**
     * @inheritDoc
     */
    public function isCaseInsensitive(): bool
    {
        return $this->caseInsensitive;
    }

    /**
     * @inheritDoc
     */
    public function getMin(): ?int
    {
        return $this->min;
    }

    /**
     * @inheritDoc
     */
    public function getMax(): ?int
    {
        return $this->max;
    }
}
