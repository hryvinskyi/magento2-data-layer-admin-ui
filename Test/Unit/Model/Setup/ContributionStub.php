<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Test\Unit\Model\Setup;

use Hryvinskyi\DataLayerAdminUi\Api\Setup\SetupContributionInterface;
use Hryvinskyi\DataLayerAdminUi\Api\Setup\SetupContributionsInterface;

/**
 * A contribution that gives what it is told to, and a pool of such contributions
 */
class ContributionStub implements SetupContributionInterface
{
    /**
     * @param array<string, string> $phrases
     * @param array<string, string> $plugins
     * @param array<string, string> $imports
     * @param array<string, mixed> $extensionData
     */
    public function __construct(
        private readonly array $phrases = [],
        private readonly array $plugins = [],
        private readonly array $imports = [],
        private readonly array $extensionData = []
    ) {
    }

    /**
     * Put contributions into a pool, in the order given
     *
     * @param SetupContributionInterface ...$contributions
     * @return SetupContributionsInterface
     */
    public static function pool(SetupContributionInterface ...$contributions): SetupContributionsInterface
    {
        return new class (array_values($contributions)) implements SetupContributionsInterface {
            /**
             * @param list<SetupContributionInterface> $contributions
             */
            public function __construct(private readonly array $contributions)
            {
            }

            /**
             * @inheritDoc
             */
            public function getContributions(): array
            {
                return $this->contributions;
            }
        };
    }

    /**
     * @inheritDoc
     */
    public function getPhrases(): array
    {
        return $this->phrases;
    }

    /**
     * @inheritDoc
     */
    public function getPlugins(): array
    {
        return $this->plugins;
    }

    /**
     * @inheritDoc
     */
    public function getImports(): array
    {
        return $this->imports;
    }

    /**
     * @inheritDoc
     */
    public function getExtensionData(): array
    {
        return $this->extensionData;
    }
}
